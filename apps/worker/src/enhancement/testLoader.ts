import { loadImage } from "./imageLoader";

async function main() {

    const image = await loadImage(
    "../api/uploads/1780242476377-INV-014_purchase_order.pdf"
    );

    console.log(image);

}

main();