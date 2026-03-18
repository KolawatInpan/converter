from pypdf import PdfReader, PdfWriter


def unlock_pdf(input_path: str, output_path: str, password: str) -> str:
    reader = PdfReader(input_path)

    if not reader.is_encrypted:
        raise ValueError("This PDF is not password protected.")

    if reader.decrypt(password) == 0:
        raise ValueError("Incorrect password for this PDF.")

    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    if reader.metadata:
        writer.add_metadata(reader.metadata)

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    writer.close()
    return output_path
