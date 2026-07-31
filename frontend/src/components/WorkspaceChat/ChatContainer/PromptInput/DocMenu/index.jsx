import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { Folder, File, MagnifyingGlass, CheckSquareOffset, Square } from "@phosphor-icons/react";
import { getCaretCoordinates } from "../../../../../utils/caret";

export default function DocMenu({
  workspace,
  showing,
  setShowing,
  onSelect,
  promptRef,
}) {
  const [position, setPosition] = useState({ left: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const menuRef = useRef(null);

  // Group workspace documents by folder
  const folders = useMemo(() => {
    if (!workspace?.documents) return {};
    const grouped = {};
    workspace.documents.forEach((doc) => {
      const parts = doc.docpath.split("/");
      const folderName = parts.length > 1 ? parts.slice(0, -1).join("/") : "Root";
      const fileName = parts[parts.length - 1];
      if (!grouped[folderName]) grouped[folderName] = [];
      grouped[folderName].push({ ...doc, fileName, folderName });
    });
    return grouped;
  }, [workspace]);

  // Position the menu using getCaretCoordinates
  useLayoutEffect(() => {
    if (showing && promptRef.current && menuRef.current) {
      const coords = getCaretCoordinates(promptRef.current, promptRef.current.selectionEnd);
      
      const textareaRect = promptRef.current.getBoundingClientRect();
      const parentRect = menuRef.current.parentElement.getBoundingClientRect();
      
      // Calculate offset of textarea from the relative parent
      const textareaLeftOffset = textareaRect.left - parentRect.left;

      setPosition({ 
        left: textareaLeftOffset + coords.left 
      });
    } else if (!showing) {
      setSearchQuery("");
      setSelectedFolder(null);
      setHighlightedIndex(0);
    }
  }, [showing, promptRef.current?.selectionEnd]);

  useEffect(() => {
    if (!showing) return;
    const handleKeyDown = (e) => {
      if (!showing) return;
      if (e.key === "Escape") {
        setShowing(false);
        e.preventDefault();
        return;
      }
      
      const itemsLength = selectedFolder
        ? filteredFiles.length
        : filteredFolders.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % itemsLength);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + itemsLength) % itemsLength);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedFolder) {
          const file = filteredFiles[highlightedIndex];
          if (file) handleFileSelect(file);
        } else {
          const folder = filteredFolders[highlightedIndex];
          if (folder) {
            setSelectedFolder(folder);
          }
          setHighlightedIndex(0);
        }
      } else if (e.key === "Backspace" && searchQuery === "" && selectedFolder) {
        setSelectedFolder(null);
        setHighlightedIndex(0);
        e.preventDefault();
      }
    };
    
    // Listen for keystrokes on the input to handle navigation
    const currentRef = promptRef.current;
    if (currentRef) {
      currentRef.addEventListener("keydown", handleKeyDown);
      return () => currentRef.removeEventListener("keydown", handleKeyDown);
    }
  }, [showing, selectedFolder, highlightedIndex, searchQuery]);

  if (!showing) return null;

  const filteredFolders = Object.keys(folders).filter((folder) =>
    folder.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFiles = selectedFolder
    ? folders[selectedFolder].filter((file) =>
        file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleFileSelect = (file) => {
    onSelect(file.docpath);
  };

  const handleSelectAll = () => {
    onSelect(selectedFolder + "/");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowing(false)}
      />
      <div
      ref={menuRef}
      className={`absolute z-50 bg-zinc-900 light:bg-slate-100 border border-slate-700/50 light:border-slate-300 rounded-lg shadow-xl w-72 max-h-64 overflow-hidden flex flex-col bottom-full mb-2`}
      style={{ left: `${position.left}px` }}
    >
        <div className="p-2 border-b border-zinc-700 light:border-slate-300 relative flex items-center">
        <MagnifyingGlass className="absolute left-4 text-gray-400 light:text-slate-500" size={16} />
        <input
          autoFocus
          className="w-full pl-8 pr-2 py-1 bg-transparent text-sm text-gray-200 light:text-slate-800 placeholder:text-zinc-500 light:placeholder:text-slate-400 focus:outline-none"
          placeholder={selectedFolder ? `Search in ${selectedFolder}...` : "Search folders..."}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && searchQuery === "" && selectedFolder) {
              setSelectedFolder(null);
            }
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto no-scroll mt-2">
        {!selectedFolder ? (
          filteredFolders.map((folder, idx) => (
            <div
              key={folder}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                highlightedIndex === idx
                  ? "bg-zinc-800 light:bg-slate-200 text-white light:text-slate-800"
                  : "text-gray-300 light:text-slate-600 hover:bg-zinc-800/50 light:hover:bg-slate-200/50"
              }`}
              onClick={() => {
                setSelectedFolder(folder);
                setSearchQuery("");
                setHighlightedIndex(0);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <Folder size={16} />
              <span className="truncate">{folder}</span>
              <span className="ml-auto text-xs text-gray-400">
                {folders[folder].length} files
              </span>
            </div>
          ))
        ) : (
          <>
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-blue-400 light:text-blue-600 hover:bg-zinc-800/50 light:hover:bg-slate-200/50 border-b border-zinc-700 light:border-slate-300"
              onClick={handleSelectAll}
            >
              <CheckSquareOffset size={16} />
              <span>Select All in {selectedFolder}</span>
            </div>
            {filteredFiles.map((file, idx) => (
              <div
                key={file.docpath}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                  highlightedIndex === idx
                    ? "bg-zinc-800 light:bg-slate-200 text-white light:text-slate-800"
                    : "text-gray-300 light:text-slate-600 hover:bg-zinc-800/50 light:hover:bg-slate-200/50"
                }`}
                onClick={() => handleFileSelect(file)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                <File size={16} />
                <span className="truncate">{file.fileName}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
    </>
  );
}
