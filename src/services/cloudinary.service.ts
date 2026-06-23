import cloudinary from '../config/cloudinary';

/**
 * Uploads an image (URL, file path, or Base64 Data URI) to Cloudinary.
 * @param fileSource Can be a Base64 string, local file path, or remote URL.
 * @param folder The target folder on Cloudinary.
 */
export async function uploadImage(
  fileSource: string,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  try {
    const uploadRes = await cloudinary.uploader.upload(fileSource, {
      folder: folder,
      resource_type: 'auto',
    });
    return {
      secure_url: uploadRes.secure_url,
      public_id: uploadRes.public_id,
    };
  } catch (error: any) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
}

/**
 * Deletes an image from Cloudinary by its public ID.
 * @param publicId The Cloudinary public ID of the resource (including folder prefix).
 */
export async function deleteImage(publicId: string): Promise<any> {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error: any) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
}

/**
 * Helper to extract the public ID from a full Cloudinary secure URL.
 * Example URL: "https://res.cloudinary.com/cloud_name/image/upload/v1717240000/minlish_avatars/avatar_123.jpg"
 * Returns: "minlish_avatars/avatar_123"
 */
export function getPublicIdFromUrl(url: string): string | null {
  try {
    const regex = /\/image\/upload\/v\d+\/(.+)\.[a-z0-9]+$/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Updates an image on Cloudinary (Deletes old image if exists, then uploads new one).
 * @param oldUrl The secure URL of the old image.
 * @param newFileSource The Base64 string or URL of the new image.
 * @param folder The target folder on Cloudinary.
 */
export async function updateImage(
  oldUrl: string | null | undefined,
  newFileSource: string,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  if (oldUrl) {
    const oldPublicId = getPublicIdFromUrl(oldUrl);
    if (oldPublicId) {
      try {
        await deleteImage(oldPublicId);
      } catch (err) {
        console.error('[Cloudinary] Failed to clean up old image:', err);
      }
    }
  }
  return uploadImage(newFileSource, folder);
}
