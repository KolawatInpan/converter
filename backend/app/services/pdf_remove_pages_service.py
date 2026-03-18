from pypdf import PdfReader, PdfWriter


def remove_pdf_pages(input_path: str, output_path: str, pages_to_remove: set[int]) -> str:
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page_index, page in enumerate(reader.pages, start=1):
        if page_index not in pages_to_remove:
            writer.add_page(page)

    if len(writer.pages) == 0:
        raise ValueError("You cannot remove every page from the PDF.")

    with open(output_path, "wb") as output_file:
        writer.write(output_file)

    writer.close()
    return output_path
