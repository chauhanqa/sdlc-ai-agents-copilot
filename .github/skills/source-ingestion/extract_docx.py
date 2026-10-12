from pathlib import Path
from zipfile import ZipFile
import argparse
import xml.etree.ElementTree as ET
import sys

WORD_NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
}


def extract_docx_text(docx_path: Path) -> str:
    if not docx_path.exists():
        raise FileNotFoundError(f"Word document not found: {docx_path}")

    if docx_path.suffix.lower() != ".docx":
        raise ValueError(
            f"Unsupported Word format: {docx_path.suffix}. "
            "Please provide a .docx document."
        )

    with ZipFile(docx_path, "r") as docx:
        try:
            document_xml = docx.read("word/document.xml")
        except KeyError as exc:
            raise ValueError(
                "The supplied file does not contain a valid Word document."
            ) from exc

    root = ET.fromstring(document_xml)

    output = []

    for paragraph in root.findall(".//w:p", WORD_NS):
        parts = []

        for text_node in paragraph.findall(".//w:t", WORD_NS):
            if text_node.text:
                parts.append(text_node.text)

        paragraph_text = "".join(parts).strip()

        if paragraph_text:
            output.append(paragraph_text)

    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description="Extract readable text from a Microsoft Word .docx file."
    )

    parser.add_argument("docx_file", help="Path to the .docx file")

    args = parser.parse_args()

    path = Path(args.docx_file).expanduser().resolve()

    try:
        text = extract_docx_text(path)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    print(text)


if __name__ == "__main__":
    main()