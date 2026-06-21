import { useEffect, useMemo, useState } from "react";

type CharacterPhotoUploadProps = {
  currentPhotoUrl: string | null;
  isUploading: boolean;
  mode: "request" | "direct";
  onUpload: (image: Blob) => Promise<void>;
};

const maxClientPhotoBytes = 2 * 1024 * 1024;
const outputSize = 512;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("Image illisible."));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Image impossible à préparer."));
      },
      "image/webp",
      0.88
    );
  });

export function CharacterPhotoUpload({
  currentPhotoUrl,
  isUploading,
  mode,
  onUpload
}: CharacterPhotoUploadProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const previewStyle = useMemo(
    () => ({
      transform: `translate(${String(offsetX)}%, ${String(offsetY)}%) scale(${String(zoom)})`
    }),
    [offsetX, offsetY, zoom]
  );

  useEffect(
    () => () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    },
    [fileUrl]
  );

  const uploadCroppedPhoto = async () => {
    if (!fileUrl) {
      return;
    }

    setFeedback(null);
    const image = await loadImage(fileUrl);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas indisponible.");
    }

    context.fillStyle = "#020811";
    context.fillRect(0, 0, outputSize, outputSize);

    const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
    const scale = baseScale * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const x = (outputSize - width) / 2 + (offsetX / 100) * outputSize;
    const y = (outputSize - height) / 2 + (offsetY / 100) * outputSize;
    context.drawImage(image, x, y, width, height);

    await onUpload(await canvasToBlob(canvas));
    setFeedback(
      mode === "direct" ? "Photo prête pour la modification." : "Photo prête pour la demande."
    );
  };

  return (
    <div className="photo-upload-panel">
      <div className="photo-preview-mask" aria-hidden="true">
        {fileUrl ? (
          <img src={fileUrl} alt="" style={previewStyle} />
        ) : currentPhotoUrl ? (
          <img src={currentPhotoUrl} alt="" />
        ) : (
          <span>Photo</span>
        )}
      </div>

      <div className="photo-upload-controls">
        <label>
          <span>Importer une photo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;

              if (!file) {
                return;
              }

              if (file.size > maxClientPhotoBytes) {
                setFeedback("Image trop volumineuse. Maximum 2 Mo.");
                return;
              }

              if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
              }

              setFileUrl(URL.createObjectURL(file));
              setFeedback(null);
              setZoom(1);
              setOffsetX(0);
              setOffsetY(0);
            }}
          />
        </label>

        {fileUrl ? (
          <div className="photo-crop-controls">
            <label>
              Zoom
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(event) => {
                  setZoom(Number(event.target.value));
                }}
              />
            </label>
            <label>
              Horizontal
              <input
                type="range"
                min="-35"
                max="35"
                step="1"
                value={offsetX}
                onChange={(event) => {
                  setOffsetX(Number(event.target.value));
                }}
              />
            </label>
            <label>
              Vertical
              <input
                type="range"
                min="-35"
                max="35"
                step="1"
                value={offsetY}
                onChange={(event) => {
                  setOffsetY(Number(event.target.value));
                }}
              />
            </label>
            <button
              type="button"
              className="ghost-button photo-use-button"
              disabled={isUploading}
              onClick={() => {
                void uploadCroppedPhoto().catch(() => {
                  setFeedback("La photo n'a pas pu être préparée.");
                });
              }}
            >
              {isUploading ? "Préparation..." : "Utiliser cette photo"}
            </button>
          </div>
        ) : null}

        {feedback ? <p className="photo-upload-feedback">{feedback}</p> : null}
      </div>
    </div>
  );
}
