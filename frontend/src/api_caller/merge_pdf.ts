import axios from "axios";
import { API_BASE_URL } from './api_base'

export async function mergePdfApi(files: File[]): Promise<Blob> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await axios.post(
    `${API_BASE_URL}/api/pdf/merge`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      responseType: "blob",
    }
  );

  return response.data;
}
