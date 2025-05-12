// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const notesDisplay = document.getElementById("notesDisplay");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const clearNotesBtn = document.getElementById("clearNotesBtn");
  const mergeMultilineCheckbox = document.getElementById("mergeMultilineCheckbox");

  // 加载"合并多行"设置
  async function loadMergeSetting() {
    try {
      const data = await chrome.storage.local.get(["mergeMultilineSetting"]);
      // 默认开启，所以如果未定义，则设为 true
      mergeMultilineCheckbox.checked = data.mergeMultilineSetting === undefined ? true : data.mergeMultilineSetting;
    } catch (error) {
      console.error("[Tiny Memo] 加载合并设置失败:", error);
      mergeMultilineCheckbox.checked = true; // 出错时也默认开启
    }
  }

  // 保存"合并多行"设置
  mergeMultilineCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ mergeMultilineSetting: mergeMultilineCheckbox.checked });
      console.log("[Tiny Memo] 合并设置已保存:", mergeMultilineCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存合并设置失败:", error);
    }
  });

  async function loadNotes() {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notesDisplay.value = notes.join("\n");
      console.log("[Tiny Memo] Notes loaded into popup display.");
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
    const notesWerePresent = notesDisplay.value !== "";

    if (!notesWerePresent) {
      console.log("[Tiny Memo] Clear button clicked, but no notes in display.");
      alert("没有笔记可以清空。");
      return;
    }

    // 直接清空，不再弹出确认对话框
    try {
      await chrome.storage.local.set({ memoNotes: [] });
      notesDisplay.value = "";
      console.log("[Tiny Memo] Notes cleared from storage and display.");
      alert("笔记已清空。");
    } catch (error) {
      console.error("清空笔记失败:", error);
      alert("清空笔记失败！");
    }
  });

  loadNotes(); // 弹窗加载时即显示笔记
  loadMergeSetting(); // 加载合并设置

  // (可选) 监听存储变化，实时更新弹窗内容
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.memoNotes) {
        console.log("[Tiny Memo] memoNotes changed in storage, reloading notes in popup.", changes.memoNotes);
        loadNotes();
      }
      if (changes.mergeMultilineSetting) {
        console.log("[Tiny Memo] mergeMultilineSetting changed in storage, reloading setting in popup.", changes.mergeMultilineSetting);
        loadMergeSetting();
      }
    }
  });
});
