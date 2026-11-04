export const photoIdPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
export const photoMimeTypes = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};
export const maxPhotoBytes = 5 * 1024 * 1024;
