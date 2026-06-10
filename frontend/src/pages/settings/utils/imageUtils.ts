export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

export const compressImage = async (
  file: File,
  options: CompressionOptions = {},
): Promise<Blob> => {
  const { maxSizeMB = 0.5, maxWidthOrHeight = 800 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              if (blob.size > maxSizeMB * 1024 * 1024) {
                const scale = Math.sqrt((maxSizeMB * 1024 * 1024) / blob.size);
                canvas.width = Math.round(width * scale);
                canvas.height = Math.round(height * scale);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob((result) => {
                    if (result) resolve(result);
                    else reject(new Error('图片压缩失败'));
                  }, 'image/webp', 0.8);
                } else {
                  resolve(blob);
                }
              } else {
                resolve(blob);
              }
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          'image/webp',
          0.8,
        );
      };
      img.onerror = () => reject(new Error('图片加载失败'));
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
  });
};

export const validateImage = (
  file: File,
  options: { allowedTypes?: string[]; maxSizeMB?: number } = {},
): { valid: boolean; error?: string } => {
  const { allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSizeMB = 2 } = options;

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `不支持的图片格式，请上传 ${allowedTypes.map(t => t.split('/')[1]).join('、')} 格式` };
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `图片大小不能超过 ${maxSizeMB}MB` };
  }

  return { valid: true };
};

export const createCropPreview = (
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  outputSize = 200,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法创建画布上下文'));
        return;
      }

      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      ctx.drawImage(
        img,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        outputSize,
        outputSize,
      );

      resolve(canvas.toDataURL('image/webp', 0.9));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
  });
};
