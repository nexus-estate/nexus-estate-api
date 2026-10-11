/** Dữ liệu tối thiểu sau validation; storage không cần metadata của Multer. */
export type ValidatedImage = {
  buffer: Buffer;
  mimetype: 'image/jpeg' | 'image/png';
};
