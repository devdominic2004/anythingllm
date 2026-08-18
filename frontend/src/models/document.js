import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Document = {
  createFolder: async (name) => {
    return await fetch(`${API_BASE}/document/create-folder`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ name }),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
  moveToFolder: async (files, folderName) => {
    const data = {
      files: files.map((file) => ({
        from: file.folderName ? `${file.folderName}/${file.name}` : file.name,
        to: `${folderName}/${file.name}`,
      })),
    };

    return await fetch(`${API_BASE}/document/move-files`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
  getRawContent: async (folderName, filename) => {
    return await fetch(`${API_BASE}/document/${folderName}/${filename}/raw`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },
  downloadOriginal: async (sourceUrlOrOptions = "") => {
    let sourceUrl = "";
    let docTitle = "";

    if (typeof sourceUrlOrOptions === "object" && sourceUrlOrOptions !== null) {
      sourceUrl = sourceUrlOrOptions.sourceUrl || "";
      docTitle = sourceUrlOrOptions.docTitle || "";
    } else if (typeof sourceUrlOrOptions === "string") {
      sourceUrl = sourceUrlOrOptions;
    }

    const params = new URLSearchParams();
    if (sourceUrl) params.append("sourceUrl", sourceUrl);
    if (docTitle) params.append("docTitle", docTitle);

    return fetch(`${API_BASE}/document/original?${params.toString()}`, {
      method: "GET",
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to download original file. It may have been deleted.");
        // Get the filename from the Content-Disposition header if possible
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'downloaded_file';
        if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(contentDisposition);
            if (matches != null && matches[1]) { 
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        return res.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        return { success: true };
      })
      .catch((e) => {
        console.error("Error downloading original file:", e);
        return { success: false, error: e.message };
      });
  },
};

export default Document;
