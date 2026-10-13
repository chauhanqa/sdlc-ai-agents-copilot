import { createHash } from "node:crypto";
import type {
  AccountCredentials,
  AccountRepository,
  PublicAccount,
} from "./account-repository.js";
import type { PasswordHasher } from "./passwords.js";
import { DUMMY_PASSWORD_HASH } from "./passwords.js";
import {
  InactiveAccountSessionError,
  type AuthenticatedSession,
  type SessionService,
} from "./sessions.js";

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type SignupResult =
  { type: "created"; account: PublicAccount } | { type: "duplicate" };

export type LoginResult =
  | {
      type: "authenticated";
      account: PublicAccount;
      token: string;
      session: AuthenticatedSession;
    }
  | { type: "invalid-credentials" }
  | { type: "deactivated" }
  | { type: "throttled" };

export interface AuthenticationService {
  signup(input: SignupInput): Promise<SignupResult>;
  login(input: LoginInput): Promise<LoginResult>;
}

export class AuthInputError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_CHARACTERS = 8;
const MAX_PASSWORD_CHARACTERS = 1024;
const MAX_NAME_CHARACTERS = 100;

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new AuthInputError("Enter a valid email address.");
  }
  return email;
}

function normalizeName(value: string, label: string): string {
  const name = value.trim();
  if (name.length === 0) {
    throw new AuthInputError(`${label} is required.`);
  }
  if (name.length > MAX_NAME_CHARACTERS) {
    throw new AuthInputError(`${label} must not exceed 100 characters.`);
  }
  return name;
}

function validateSignupPassword(password: string): void {
  const characterCount = Array.from(password).length;
  if (
    characterCount < MIN_PASSWORD_CHARACTERS ||
    characterCount > MAX_PASSWORD_CHARACTERS
  ) {
    throw new AuthInputError("Password must be between 8 and 1024 characters.");
  }
}

function validateLoginPassword(password: string): void {
  if (Array.from(password).length > MAX_PASSWORD_CHARACTERS) {
    throw new AuthInputError("Password must not exceed 1024 characters.");
  }
}

function loginKeyHash(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function toPublicAccount(account: AccountCredentials): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
  };
}

export function createAuthenticationService(
  accounts: AccountRepository,
  sessions: SessionService,
  passwords: PasswordHasher,
): AuthenticationService {
  return {
    async signup(input) {
      const email = normalizeEmail(input.email);
      const firstName = normalizeName(input.firstName, "First name");
      const lastName = normalizeName(input.lastName, "Last name");
      validateSignupPassword(input.password);

      const passwordHash = await passwords.hash(input.password);
      const account = await accounts.createAccount({
        email,
        firstName,
        lastName,
        passwordHash,
      });
      return account ? { type: "created", account } : { type: "duplicate" };
    },

    async login(input) {
      const email = normalizeEmail(input.email);
      validateLoginPassword(input.password);
      const keyHash = loginKeyHash(email);
      if (await accounts.isLoginBlocked(keyHash)) {
        return { type: "throttled" };
      }

      const account = await accounts.findCredentialsByEmail(email);
      const passwordMatches = await passwords.verify(
        account?.passwordHash ?? DUMMY_PASSWORD_HASH,
        input.password,
      );
      if (!account || !passwordMatches) {
        return (await accounts.recordFailedLogin(keyHash))
          ? { type: "throttled" }
          : { type: "invalid-credentials" };
      }

      if (account.status === "deactivated") {
        await accounts.clearFailedLogins(keyHash);
        return { type: "deactivated" };
      }

      let issued: Awaited<ReturnType<SessionService["issue"]>>;
      try {
        issued = await sessions.issue(account.id);
      } catch (error) {
        if (!(error instanceof InactiveAccountSessionError)) {
          throw error;
        }

        const currentAccount = await accounts.findCredentialsByEmail(email);
        if (!currentAccount || currentAccount.status === "deactivated") {
          await accounts.clearFailedLogins(keyHash);
          return currentAccount
            ? { type: "deactivated" }
            : { type: "invalid-credentials" };
        }
        throw error;
      }

      await accounts.clearFailedLogins(keyHash);
      return {
        type: "authenticated",
        account: toPublicAccount(account),
        token: issued.token,
        session: issued.session,
      };
    },
  };
}
