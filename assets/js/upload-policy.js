export const MAX_FILES=20;
export const MAX_BYTES=50*1024*1024;
const PHOTO_TYPES=new Set(['image/jpeg','image/png','image/webp','image/heic']);
const VIDEO_TYPES=new Set(['video/mp4','video/quicktime']);
export function validateUpload(file,kind,count){
  if(count>=MAX_FILES)return 'Puede adjuntar hasta 20 archivos en total entre fotos y videos.';
  if(!file.size)return `"${file.name}" está vacío y no se puede subir.`;
  if(file.size>MAX_BYTES)return `"${file.name}" pesa más de 50 MB y no se puede subir.`;
  const allowed=kind==='photo'?PHOTO_TYPES:VIDEO_TYPES;
  if(!allowed.has(file.type))return `"${file.name}" no tiene un formato compatible. Use ${kind==='photo'?'JPG, PNG, WebP o HEIC':'MP4 o MOV'}.`;
  return null;
}
