from pypdf import PdfReader, PdfWriter


def rearrange_pdf_pages(input_path: str, output_path: str, page_order: list[int]) -> str:
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page_number in page_order:
        writer.add_page(reader.pages[page_number - 1])

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    writer.close()
    return output_path
