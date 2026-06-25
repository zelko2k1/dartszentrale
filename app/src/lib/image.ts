// Verkleinert ein hochgeladenes Bild auf ein zentriertes Quadrat (Cover-Crop) und gibt einen kleinen
// PNG-Blob zurück. Hält Upload & Speicher klein (Profilfotos müssen nicht groß sein).
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function downscaleSquare(file: File, size = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bild konnte nicht verarbeitet werden.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas nicht verfügbar.')); return; }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.')), 'image/png');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
