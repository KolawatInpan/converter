from pypdf import PdfReader, PdfWriter


def protect_pdf(input_path: str, output_path: str, password: str) -> str:
    reader = PdfReader(input_path)

    if reader.is_encrypted:
        raise ValueError("This PDF is already password protected.")

    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    if reader.metadata:
        writer.add_metadata(reader.metadata)

    writer.encrypt(password)

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    writer.close()
    return output_path
