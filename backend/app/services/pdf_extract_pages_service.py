from pypdf import PdfReader, PdfWriter


def extract_pdf_pages(input_path: str, output_path: str, pages_to_extract: list[int]) -> str:
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page_number in pages_to_extract:
        writer.add_page(reader.pages[page_number - 1])

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    writer.close()
    return output_path
