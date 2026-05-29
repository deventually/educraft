import type { ImageInput } from "~/lib/ai/types";

/** Max file size per image: 5 MB. */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** Max number of images per field. */
const MAX_IMAGES = 10;

/** Max dimensions for downscaling target (keeps aspect ratio). */
const DOWNSCALE_TARGET_SIZE = 2048;

/**
 * Validates a single file:
 * - MIME type must match accept list
 * - File size must not exceed MAX_IMAGE_SIZE
 * Returns error message if invalid, undefined if valid.
 */
export function validateImageFile(file: File, acceptMimes: string): string | undefined {
  const mimes = acceptMimes.split(",").map((m) => m.trim());

  if (!mimes.includes(file.type)) {
    return `Invalid file type: ${file.name}. Accepted types: ${acceptMimes}`;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return `File too large: ${file.name}. Maximum size is 5 MB.`;
  }

  return undefined;
}

/**
 * Validates a batch of files:
 * - Each file must be valid (see validateImageFile)
 * - Total count must not exceed MAX_IMAGES
 * Returns error message if invalid, undefined if valid.
 */
export function validateImageBatch(files: File[], acceptMimes: string): string | undefined {
  for (const file of files) {
    const error = validateImageFile(file, acceptMimes);
    if (error) return error;
  }

  if (files.length > MAX_IMAGES) {
    return `Too many images: maximum ${MAX_IMAGES} allowed, got ${files.length}`;
  }

  return undefined;
}

/**
 * Reads a file/blob as base64 string (without data: prefix).
 */
function fileToBase64(fileOrBlob: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:image/png;base64," prefix if present
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Downscales an image if it exceeds DOWNSCALE_TARGET_SIZE.
 * Returns the blob data (as Blob or original File) for encoding.
 */
async function downscaleImageIfNeeded(file: File): Promise<Blob | File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Check if downscaling is needed
      if (img.width <= DOWNSCALE_TARGET_SIZE && img.height <= DOWNSCALE_TARGET_SIZE) {
        // No downscaling needed
        resolve(file);
        return;
      }

      // Calculate new dimensions, maintaining aspect ratio
      let newWidth = img.width;
      let newHeight = img.height;

      if (img.width > img.height) {
        newWidth = DOWNSCALE_TARGET_SIZE;
        newHeight = Math.round((img.height * DOWNSCALE_TARGET_SIZE) / img.width);
      } else {
        newHeight = DOWNSCALE_TARGET_SIZE;
        newWidth = Math.round((img.width * DOWNSCALE_TARGET_SIZE) / img.height);
      }

      // Draw on canvas and compress
      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
        },
        file.type,
        0.85, // JPEG quality 85%
      );
    };

    img.onerror = () => {
      // If image fails to load, return original
      resolve(file);
    };

    // Load image from file
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Converts a File to an ImageInput object.
 * - Downscales if needed
 * - Converts to base64
 */
export async function fileToImageInput(file: File): Promise<ImageInput> {
  const scaled = await downscaleImageIfNeeded(file);
  const dataBase64 = await fileToBase64(scaled);

  return {
    mediaType: file.type,
    dataBase64,
  };
}

/**
 * Processes multiple files into ImageInput array.
 * Applies validation, downscaling, and base64 encoding.
 */
export async function filesToImageInputs(
  files: File[],
  acceptMimes: string,
): Promise<ImageInput[]> {
  const error = validateImageBatch(files, acceptMimes);
  if (error) {
    throw new Error(error);
  }

  const images = await Promise.all(files.map((f) => fileToImageInput(f)));
  return images;
}

export { MAX_IMAGE_SIZE, MAX_IMAGES, DOWNSCALE_TARGET_SIZE };
