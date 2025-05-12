// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const notesDisplay = document.getElementById("notesDisplay");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const clearNotesBtn = document.getElementById("clearNotesBtn");

  async function loadNotes() {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notesDisplay.value = notes.join("\n");
    } catch (error) {
      console.error("加载笔记失败:", error);
      notesDisplay.value = "加载笔记出错。";
    }
  }

  copyMarkdownBtn.addEventListener("click", async () => {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      if (notes.length === 0) {
        alert("没有笔记可以复制。");
        return;
      }
      const markdownNotes = notes.map((note) => `- ${note}`).join("\n");
      await navigator.clipboard.writeText(markdownNotes);
      copyMarkdownBtn.textContent = "已复制!";
      setTimeout(() => {
        copyMarkdownBtn.textContent = "复制为 Markdown";
      }, 2000);
    } catch (error) {
      console.error("复制笔记失败:", error);
      alert("复制失败！");
    }
  });

  clearNotesBtn.addEventListener("click", async () => {
    if (notesDisplay.value === "" || confirm("确定要清空所有笔记吗？此操作无法撤销。")) {
      try {
        await chrome.storage.local.set({ memoNotes: [] });
        notesDisplay.value = "";
        if (notesDisplay.value !== "") alert("笔记已清空。"); // 只有在原本有内容时提示
      } catch (error) {
        console.error("清空笔记失败:", error);
        alert("清空笔记失败！");
      }
    }
  });

  loadNotes(); // 弹窗加载时即显示笔记

  // (可选) 监听存储变化，实时更新弹窗内容
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.memoNotes) {
      loadNotes();
    }
  });
});
