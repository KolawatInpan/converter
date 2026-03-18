from pypdf import PdfWriter


def merge_pdfs(input_paths: list[str], output_path: str) -> str:
    writer = PdfWriter()

    for path in input_paths:
        writer.append(path)

    with open(output_path, "wb") as f:
        writer.write(f)

    writer.close()
    return output_path
