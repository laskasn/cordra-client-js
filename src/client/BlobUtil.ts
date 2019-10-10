export enum BlobMethod {
    arrayBuffer,
    dataUrl,
    binaryString,
    text
}

export class BlobUtil {
    public static readBlob(blob: Blob, method: BlobMethod = BlobMethod.arrayBuffer, encoding: string = 'utf8'): Promise<any> {
        const reader = new FileReader();

        const promise = new Promise<any>(((resolve, reject) => {
            reader.addEventListener('loadend', function onend() {
                reader.removeEventListener('loadend', onend);
                if (reader.error) {
                    reject(reader.error);
                } else {
                    resolve(reader.result);
                }
            });
        }));

        if (method === BlobMethod.arrayBuffer) {
            reader.readAsArrayBuffer(blob);
        } else if (method === BlobMethod.dataUrl) {
            reader.readAsDataURL(blob);
        } else if (method === BlobMethod.binaryString) {
            reader.readAsBinaryString(blob);
        } else { // if (method === BlobMethod.text) {
            reader.readAsText(blob, encoding);
        }

        return promise;
    }
}
