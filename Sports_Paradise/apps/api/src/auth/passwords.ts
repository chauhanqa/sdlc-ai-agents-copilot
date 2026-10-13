import argon2 from "argon2";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export const passwordHasher: PasswordHasher = {
  hash(password) {
    return argon2.hash(password, { type: argon2.argon2id });
  },

  verify(passwordHash, password) {
    return argon2.verify(passwordHash, password);
  },
};

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=4,t=3$T7iUnA1Efhpmn1Gbwx6Xow$lKFSRFeHbuzDPqJpjuNeRWdKIO10SV/3JFsNSU3JuuQ";
