// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const notesDisplay = document.getElementById("notesDisplay");
  const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
  const clearNotesBtn = document.getElementById("clearNotesBtn");
  const mergeMultilineCheckbox = document.getElementById("mergeMultilineCheckbox");
  const ttsVoiceSelect = document.getElementById("ttsVoiceSelect");
  const autoTtsCheckbox = document.getElementById("autoTtsCheckbox");
  const hoverButtonsCheckbox = document.getElementById("hoverButtonsCheckbox");

  // 网站配置相关元素
  const siteConfigList = document.getElementById("siteConfigList");
  const addSiteConfigBtn = document.getElementById("addSiteConfigBtn");
  const getCurrentSiteBtn = document.getElementById("getCurrentSiteBtn");
  const configModal = document.getElementById("configModal");
  const domainInput = document.getElementById("domainInput");
  const selectorInput = document.getElementById("selectorInput");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const cancelConfigBtn = document.getElementById("cancelConfigBtn");

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

  // 加载"自动TTS"设置
  async function loadAutoTtsSetting() {
    try {
      const data = await chrome.storage.local.get(["autoTtsSetting"]);
      // 默认关闭，所以如果未定义，则设为 false
      autoTtsCheckbox.checked = data.autoTtsSetting === true;
      console.log("[Tiny Memo] 自动TTS设置已加载:", autoTtsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 加载自动TTS设置失败:", error);
      autoTtsCheckbox.checked = false; // 出错时默认关闭
    }
  }

  // 保存"自动TTS"设置
  autoTtsCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ autoTtsSetting: autoTtsCheckbox.checked });
      console.log("[Tiny Memo] 自动TTS设置已保存:", autoTtsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存自动TTS设置失败:", error);
    }
  });

  // 加载"鼠标悬停按钮"设置
  async function loadHoverButtonsSetting() {
    try {
      const data = await chrome.storage.local.get(["hoverButtonsSetting"]);
      // 默认关闭
      hoverButtonsCheckbox.checked = data.hoverButtonsSetting === true;
      console.log("[Tiny Memo] 悬停按钮设置已加载:", hoverButtonsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 加载悬停按钮设置失败:", error);
      hoverButtonsCheckbox.checked = false; // 出错时默认关闭
    }
  }

  // 保存"鼠标悬停按钮"设置
  hoverButtonsCheckbox.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ hoverButtonsSetting: hoverButtonsCheckbox.checked });
      console.log("[Tiny Memo] 悬停按钮设置已保存:", hoverButtonsCheckbox.checked);
    } catch (error) {
      console.error("[Tiny Memo] 保存悬停按钮设置失败:", error);
    }
  });

  // 加载TTS语音选项
  async function loadTtsVoices() {
    try {
      // 先加载当前选择的语音
      const settings = await chrome.storage.local.get(["ttsVoice"]);
      const currentVoice = settings.ttsVoice || "zh-CN-XiaoxiaoNeural"; // 默认中文语音

      // 从背景脚本获取语音列表
      chrome.runtime.sendMessage({ type: "GET_TTS_VOICES" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[Tiny Memo] 获取TTS语音列表失败:", chrome.runtime.lastError);
          return;
        }

        if (response && response.success && response.voices) {
          populateVoiceSelect(response.voices, currentVoice);
        } else {
          console.error("[Tiny Memo] 获取TTS语音列表响应错误:", response?.error);
        }
      });
    } catch (error) {
      console.error("[Tiny Memo] 加载TTS语音设置失败:", error);
    }
  }

  // 填充语音选择下拉菜单
  function populateVoiceSelect(voices, currentVoice) {
    // 清空现有选项
    ttsVoiceSelect.innerHTML = "";

    // 常用语言（优先显示）
    const commonLanguages = ["zh", "en", "ja"];
    const languageNames = {
      zh: "中文",
      en: "英语",
      ja: "日语",
      ko: "韩语",
      fr: "法语",
      de: "德语",
      es: "西班牙语",
    };

    // 如果voices不是按语言分组的，则创建一个简单列表
    if (!voices.zh && Array.isArray(voices)) {
      voices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name || voice;
        option.text = voice.displayName || voice.name || voice;
        if (voice.name === currentVoice || voice === currentVoice) {
          option.selected = true;
        }
        ttsVoiceSelect.appendChild(option);
      });
      return;
    }

    // 按语言分组添加语音选项
    // 先添加常用语言
    commonLanguages.forEach((lang) => {
      if (voices[lang] && voices[lang].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = languageNames[lang] || lang;

        voices[lang].forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.text = voice.displayName || `${voice.name}`;
          if (voice.name === currentVoice) {
            option.selected = true;
          }
          optgroup.appendChild(option);
        });

        ttsVoiceSelect.appendChild(optgroup);
      }
    });

    // 添加其他语言
    Object.keys(voices).forEach((lang) => {
      if (!commonLanguages.includes(lang) && voices[lang] && voices[lang].length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = languageNames[lang] || lang;

        voices[lang].forEach((voice) => {
          const option = document.createElement("option");
          option.value = voice.name;
          option.text = voice.displayName || `${voice.name}`;
          if (voice.name === currentVoice) {
            option.selected = true;
          }
          optgroup.appendChild(option);
        });

        ttsVoiceSelect.appendChild(optgroup);
      }
    });
  }

  // 保存TTS语音设置
  ttsVoiceSelect.addEventListener("change", async () => {
    const selectedVoice = ttsVoiceSelect.value;
    if (selectedVoice) {
      try {
        await chrome.storage.local.set({ ttsVoice: selectedVoice });
        console.log("[Tiny Memo] TTS语音设置已保存:", selectedVoice);
      } catch (error) {
        console.error("[Tiny Memo] 保存TTS语音设置失败:", error);
      }
    }
  });

  async function loadNotes() {
    try {
      const data = await chrome.storage.local.get(["memoNotes"]);
      const notes = data.memoNotes || [];
      notesDisplay.value = notes.join("\n");
      console.log("[Tiny Memo] Notes loaded into popup display.");
    } catch (error) {
      console.error("[Tiny Memo] 加载笔记失败:", error);
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
      console.error("[Tiny Memo] 复制笔记失败:", error);
      alert("复制失败！");
    }
  });

  // "复制并清空笔记" 按钮的逻辑
  clearNotesBtn.addEventListener("click", async () => {
    const currentNotesValue = notesDisplay.value;

    if (currentNotesValue === "") {
      console.log("[Tiny Memo] Copy & Clear button clicked, but no notes in display.");
      alert("没有笔记可以操作。");
      return;
    }

    try {
      // 1. 先执行复制操作 (在 popup 中完成)
      const notesToCopy = currentNotesValue
        .split("\n")
        .map((note) => `- ${note}`)
        .join("\n");
      await navigator.clipboard.writeText(notesToCopy);
      console.log("[Tiny Memo] Notes copied to clipboard from popup.");

      // 2. 发送消息给 background 请求清空
      console.log("[Tiny Memo] Sending request to background to clear notes.");
      const response = await chrome.runtime.sendMessage({ type: "COPY_AND_CLEAR_REQUEST" });

      // 3. 处理 background 的响应
      if (response && response.success) {
        notesDisplay.value = ""; // 响应成功后清空显示区域
        console.log("[Tiny Memo] Background confirmed notes cleared.");
        alert("笔记已复制并清空。"); // 使用后台返回的消息或固定文本
      } else {
        console.error("[Tiny Memo] Background script failed to clear notes:", response?.message);
        alert(response?.message || "清空笔记时发生错误。");
      }
    } catch (error) {
      console.error("[Tiny Memo] Error during copy & clear in popup:", error);
      if (error.message.includes("clipboard.writeText")) {
        alert("复制笔记失败！请检查剪贴板权限。");
      } else {
        alert("操作失败！请重试。");
      }
    }
  });

  // 加载网站元素配置
  async function loadSiteConfigs() {
    try {
      const data = await chrome.storage.local.get(["siteConfigs"]);
      const configs = data.siteConfigs || [];
      renderSiteConfigs(configs);
      console.log("[Tiny Memo] 网站配置已加载:", configs);
    } catch (error) {
      console.error("[Tiny Memo] 加载网站配置失败:", error);
    }
  }

  // 渲染网站配置列表
  function renderSiteConfigs(configs) {
    siteConfigList.innerHTML = "";
    if (configs.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = '暂无配置，点击"添加配置"按钮开始添加';
      emptyMsg.style.color = "#666";
      emptyMsg.style.fontSize = "12px";
      emptyMsg.style.padding = "5px";
      siteConfigList.appendChild(emptyMsg);
      return;
    }

    configs.forEach((config, index) => {
      const configItem = document.createElement("div");
      configItem.style.display = "flex";
      configItem.style.justifyContent = "space-between";
      configItem.style.alignItems = "center";
      configItem.style.padding = "3px 0";
      configItem.style.borderBottom = index < configs.length - 1 ? "1px solid #eee" : "none";

      const configText = document.createElement("div");
      configText.textContent = `${config.domain} → ${config.selector}`;
      configText.style.fontSize = "12px";
      configText.style.overflow = "hidden";
      configText.style.textOverflow = "ellipsis";
      configText.style.whiteSpace = "nowrap";
      configText.style.marginRight = "5px";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "×";
      deleteBtn.style.backgroundColor = "transparent";
      deleteBtn.style.border = "none";
      deleteBtn.style.color = "#999";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.style.fontSize = "14px";
      deleteBtn.style.padding = "0 5px";
      deleteBtn.title = "删除配置";

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSiteConfig(index);
      });

      configItem.appendChild(configText);
      configItem.appendChild(deleteBtn);
      siteConfigList.appendChild(configItem);
    });
  }

  // 删除网站配置
  async function deleteSiteConfig(index) {
    try {
      const data = await chrome.storage.local.get(["siteConfigs"]);
      const configs = data.siteConfigs || [];
      if (index >= 0 && index < configs.length) {
        configs.splice(index, 1);
        await chrome.storage.local.set({ siteConfigs: configs });
        renderSiteConfigs(configs);
        console.log("[Tiny Memo] 网站配置已删除");
      }
    } catch (error) {
      console.error("[Tiny Memo] 删除网站配置失败:", error);
    }
  }

  // 添加网站配置
  async function addSiteConfig(domain, selector) {
    try {
      if (!domain || !selector) return false;

      const data = await chrome.storage.local.get(["siteConfigs"]);
      const configs = data.siteConfigs || [];

      // 检查是否已存在相同配置
      const exists = configs.some((config) => config.domain === domain && config.selector === selector);

      if (!exists) {
        configs.push({ domain, selector });
        await chrome.storage.local.set({ siteConfigs: configs });
        renderSiteConfigs(configs);
        console.log("[Tiny Memo] 网站配置已添加:", { domain, selector });
        return true;
      } else {
        alert("该配置已存在");
        return false;
      }
    } catch (error) {
      console.error("[Tiny Memo] 添加网站配置失败:", error);
      return false;
    }
  }

  // 显示配置模态框
  addSiteConfigBtn.addEventListener("click", () => {
    domainInput.value = "";
    selectorInput.value = "";
    configModal.style.display = "block";
  });

  // 获取当前网站信息
  getCurrentSiteBtn.addEventListener("click", async () => {
    try {
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        const url = new URL(tabs[0].url);
        domainInput.value = url.hostname;
        configModal.style.display = "block";
      }
    } catch (error) {
      console.error("[Tiny Memo] 获取当前网站失败:", error);
    }
  });

  // 保存配置
  saveConfigBtn.addEventListener("click", async () => {
    const domain = domainInput.value.trim();
    const selector = selectorInput.value.trim();

    if (!domain) {
      alert("请输入网站域名");
      return;
    }

    if (!selector) {
      alert("请输入CSS选择器");
      return;
    }

    const success = await addSiteConfig(domain, selector);
    if (success) {
      configModal.style.display = "none";
    }
  });

  // 取消配置
  cancelConfigBtn.addEventListener("click", () => {
    configModal.style.display = "none";
  });

  // 点击模态框外部关闭
  configModal.addEventListener("click", (e) => {
    if (e.target === configModal) {
      configModal.style.display = "none";
    }
  });

  loadNotes(); // 弹窗加载时即显示笔记
  loadMergeSetting(); // 加载合并设置
  loadTtsVoices(); // 加载TTS语音选项
  loadAutoTtsSetting(); // 加载自动TTS设置
  loadHoverButtonsSetting(); // 加载悬停按钮设置
  loadSiteConfigs(); // 加载网站配置

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
      if (changes.ttsVoice) {
        console.log("[Tiny Memo] ttsVoice changed in storage, reloading setting in popup.", changes.ttsVoice);
        // 只需更新下拉框选中值，无需重新加载所有语音
        if (ttsVoiceSelect.value !== changes.ttsVoice.newValue) {
          const options = Array.from(ttsVoiceSelect.options);
          const matching = options.find((opt) => opt.value === changes.ttsVoice.newValue);
          if (matching) {
            matching.selected = true;
          }
        }
      }
      if (changes.autoTtsSetting) {
        console.log("[Tiny Memo] autoTtsSetting changed in storage, reloading setting in popup.", changes.autoTtsSetting);
        autoTtsCheckbox.checked = changes.autoTtsSetting.newValue === true;
      }
      if (changes.hoverButtonsSetting) {
        console.log("[Tiny Memo] hoverButtonsSetting changed in storage, reloading setting in popup.", changes.hoverButtonsSetting);
        hoverButtonsCheckbox.checked = changes.hoverButtonsSetting.newValue === true;
      }
      if (changes.siteConfigs) {
        console.log("[Tiny Memo] siteConfigs changed in storage, reloading configs in popup.", changes.siteConfigs);
        renderSiteConfigs(changes.siteConfigs.newValue || []);
      }
    }
  });
});
