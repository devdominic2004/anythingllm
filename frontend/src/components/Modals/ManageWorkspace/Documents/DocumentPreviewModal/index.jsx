import React, { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";
import ModalWrapper from "@/components/ModalWrapper";
import Document from "@/models/document";
import showToast from "@/utils/toast";

export default function DocumentPreviewModal({ isOpen, closeModal, item, folderName }) {
  const [content, setContent] = useState("");
  const [rawXml, setRawXml] = useState("");
  const [rawXmlOriginal, setRawXmlOriginal] = useState("");
  const [viewMode, setViewMode] = useState("markdown"); // "markdown" | "html" | "xml"
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchContent() {
      if (!isOpen || !item) return;
      setLoading(true);
      try {
        const _folderName = item.folderName || folderName || "custom-documents";
        const { success, pageContent, preProcessedContent, rawXmlContent, error } = await Document.getRawContent(_folderName, item.name);
        
        if (success) {
          setContent(pageContent || "No Markdown content available.");
          setRawXml(preProcessedContent || "No intermediate HTML available for this document.");
          setRawXmlOriginal(rawXmlContent || "No raw XML available for this document.");
        } else {
          showToast(`Failed to fetch document content: ${error}`, "error", { clear: true });
        }
      } catch (err) {
        showToast("An error occurred while fetching document content.", "error", { clear: true });
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, [isOpen, item, folderName]);

  if (!isOpen) return null;

  return (
    <ModalWrapper isOpen={isOpen}>
      <div className="w-full max-w-4xl bg-theme-bg-secondary rounded-lg shadow-xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-theme-text-primary">
              Document Preview: {item?.title || "Unknown"}
            </h2>
            <div className="flex gap-4 mt-2">
              {(item?.name?.toLowerCase().endsWith(".docx") || !!rawXmlOriginal) && (
                <label className="flex items-center gap-2 cursor-pointer text-theme-text-secondary">
                  <input
                    type="radio"
                    name="viewMode"
                    value="xml"
                    checked={viewMode === "xml"}
                    onChange={() => setViewMode("xml")}
                    className="cursor-pointer"
                  />
                  {item?.name?.toLowerCase().endsWith(".docx") ? "1. Native XML" : "1. Native Content"}
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-theme-text-secondary">
                <input
                  type="radio"
                  name="viewMode"
                  value="html"
                  checked={viewMode === "html"}
                  onChange={() => setViewMode("html")}
                  className="cursor-pointer"
                />
                {item?.name?.toLowerCase().endsWith(".docx") ? "2. Intermediate HTML" : item?.name?.toLowerCase().endsWith(".xlsx") ? "2. Raw CSV (Intermediate)" : "2. Intermediate Content"}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-theme-text-secondary">
                <input
                  type="radio"
                  name="viewMode"
                  value="markdown"
                  checked={viewMode === "markdown"}
                  onChange={() => setViewMode("markdown")}
                  className="cursor-pointer"
                />
                {item?.name?.toLowerCase().endsWith(".docx") ? "3. Final Markdown" : item?.name?.toLowerCase().endsWith(".xlsx") ? "3. Final Key-Value (For AI)" : "3. Final Content"}
              </label>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="p-1 hover:bg-theme-bg-primary rounded-full transition-colors text-theme-text-secondary"
          >
            <X size={24} weight="bold" />
          </button>
        </div>
        
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-theme-text-secondary">
              <p>Loading document content...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-theme-bg-primary rounded p-4 border border-theme-border">
              <pre className="text-theme-text-primary text-sm whitespace-pre-wrap font-mono">
                {viewMode === "markdown" && content}
                {viewMode === "html" && rawXml}
                {viewMode === "xml" && rawXmlOriginal}
              </pre>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
}
