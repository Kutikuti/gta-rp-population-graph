import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CharacterPhotoUpload } from "./CharacterPhotoUpload";

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
const fillRect = vi.fn();
const drawImage = vi.fn();

class LoadableImage {
  width = 1000;
  height = 500;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const imageFile = (name = "camille.webp") =>
  new File(["image-content"], name, { type: "image/webp" });

describe("CharacterPhotoUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURL.mockReturnValue("blob:character-photo");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Image", LoadableImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      fillRect,
      fillStyle: ""
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["webp"], { type: "image/webp" }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the current photo until a new file is selected", () => {
    const { container } = render(
      <CharacterPhotoUpload
        currentPhotoUrl="/uploads/current.webp"
        isUploading={false}
        mode="request"
        onUpload={vi.fn(async () => undefined)}
      />
    );

    expect(container.querySelector(".photo-preview-mask img")).toHaveAttribute(
      "src",
      "/uploads/current.webp"
    );
    expect(screen.getByText("Aucun fichier choisi")).toBeInTheDocument();
  });

  it("rejects files larger than two megabytes before creating a preview", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <CharacterPhotoUpload
        currentPhotoUrl={null}
        isUploading={false}
        mode="request"
        onUpload={vi.fn(async () => undefined)}
      />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const oversizedFile = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.webp", {
      type: "image/webp"
    });

    expect(input).not.toBeNull();
    await user.upload(input as HTMLInputElement, oversizedFile);

    expect(screen.getByText("Image trop volumineuse. Maximum 2 Mo.")).toBeInTheDocument();
    expect(screen.getByText("large.webp")).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Utiliser cette photo" })).not.toBeInTheDocument();
  });

  it("updates the circular preview and releases object URLs", async () => {
    const user = userEvent.setup();
    createObjectURL.mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const { container, unmount } = render(
      <CharacterPhotoUpload
        currentPhotoUrl={null}
        isUploading={false}
        mode="request"
        onUpload={vi.fn(async () => undefined)}
      />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await user.upload(input as HTMLInputElement, imageFile("first.webp"));
    expect(container.querySelector(".photo-preview-mask img")).toHaveAttribute("src", "blob:first");

    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("slider", { name: "Horizontal" }), {
      target: { value: "10" }
    });
    fireEvent.change(screen.getByRole("slider", { name: "Vertical" }), {
      target: { value: "-10" }
    });
    expect(container.querySelector(".photo-preview-mask img")).toHaveStyle({
      transform: "translate(10%, -10%) scale(2)"
    });

    await user.upload(input as HTMLInputElement, imageFile("second.webp"));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveValue("1");
    expect(container.querySelector(".photo-preview-mask img")).toHaveAttribute(
      "src",
      "blob:second"
    );

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });

  it.each([
    ["direct", "Photo prête pour la modification."],
    ["request", "Photo prête pour la demande."]
  ] as const)("crops and uploads a photo in %s mode", async (mode, expectedFeedback) => {
    const user = userEvent.setup();
    const onUpload = vi.fn(async (_image: Blob) => undefined);
    const { container } = render(
      <CharacterPhotoUpload
        currentPhotoUrl={null}
        isUploading={false}
        mode={mode}
        onUpload={onUpload}
      />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await user.upload(input as HTMLInputElement, imageFile());
    fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("slider", { name: "Horizontal" }), {
      target: { value: "10" }
    });
    fireEvent.change(screen.getByRole("slider", { name: "Vertical" }), {
      target: { value: "-10" }
    });
    await user.click(screen.getByRole("button", { name: "Utiliser cette photo" }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(onUpload.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(drawImage).toHaveBeenCalledWith(expect.any(LoadableImage), -716.8, -307.2, 2048, 1024);
    expect(await screen.findByText(expectedFeedback)).toBeInTheDocument();
  });

  it("reports preparation errors and disables submission while uploading", async () => {
    const user = userEvent.setup();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const onUpload = vi.fn(async () => undefined);
    const { container, rerender } = render(
      <CharacterPhotoUpload
        currentPhotoUrl={null}
        isUploading={false}
        mode="request"
        onUpload={onUpload}
      />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await user.upload(input as HTMLInputElement, imageFile());
    await user.click(screen.getByRole("button", { name: "Utiliser cette photo" }));
    expect(await screen.findByText("La photo n'a pas pu être préparée.")).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();

    rerender(
      <CharacterPhotoUpload currentPhotoUrl={null} isUploading mode="request" onUpload={onUpload} />
    );
    expect(screen.getByRole("button", { name: "Préparation..." })).toBeDisabled();
  });
});
