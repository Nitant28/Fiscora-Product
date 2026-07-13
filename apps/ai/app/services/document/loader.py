import io

import fitz

from pathlib import Path

from PIL import Image

from app.contracts.document import (
    DocumentContract,
    DocumentPage,
)

from app.services.document.metadata import MetadataExtractor


class DocumentLoader:

    def load_pdf(
        self,
        path: Path,
    ) -> DocumentContract:

        pdf = fitz.open(path)

        metadata = MetadataExtractor.extract(path)

        metadata.total_pages = len(pdf)

        document = DocumentContract(

            source=path,

            metadata=metadata,

        )

        for index, page in enumerate(pdf):

            pix = page.get_pixmap(
                dpi=300,
                alpha=False,
            )

            image = Image.open(
                io.BytesIO(
                    pix.tobytes("png")
                )
            )

            document.pages.append(

                DocumentPage(

                    page_number=index + 1,

                    image=image,

                    width=image.width,

                    height=image.height,

                    dpi=300,

                    rotation=page.rotation,

                )

            )

        pdf.close()

        return document

    def load_image(
        self,
        path: Path,
    ) -> DocumentContract:

        image = Image.open(path)

        metadata = MetadataExtractor.extract(path)

        metadata.total_pages = 1

        document = DocumentContract(

            source=path,

            metadata=metadata,

        )

        document.pages.append(

            DocumentPage(

                page_number=1,

                image=image,

                width=image.width,

                height=image.height,

                dpi=300,

            )

        )

        return document