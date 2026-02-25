import type { FileUIPart } from "ai";

function isFileUIPart(value: File | FileUIPart): value is FileUIPart {
  return "mediaType" in value && "url" in value;
}

export async function convertFilesToDataURLs(files: File[] | FileList | FileUIPart[]): Promise<FileUIPart[]> {
  const firstItem = (files as ArrayLike<File | FileUIPart>)[0];
  if (!firstItem) {
    return [];
  }

  if (isFileUIPart(firstItem)) {
    return Array.from(files as FileUIPart[]);
  }

  return Promise.all(
    Array.from(files as File[] | FileList).map(
      (file) =>
        new Promise<FileUIPart>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              type: "file",
              mediaType: file.type,
              url: reader.result as string,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );
}
