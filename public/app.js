const MAX_CLIP_SECONDS = 29;
const audioInput = document.getElementById('audioInput');
const uploadArea = document.getElementById('uploadArea');
const playerSection = document.getElementById('playerSection');
const rangeSection = document.getElementById('rangeSection');
const statusBar = document.getElementById('statusBar');
const downloadSection = document.getElementById('downloadSection');
const downloadLink = document.getElementById('downloadLink');

const audioPlayer = document.getElementById('audioPlayer');
const trackNameEl = document.getElementById('trackName');
const trackDurationEl = document.getElementById('trackDuration');

const startSlider = document.getElementById('startSlider');
const endSlider = document.getElementById('endSlider');
const startLabel = document.getElementById('startLabel');
const endLabel = document.getElementById('endLabel');
const lengthLabel = document.getElementById('lengthLabel');

const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');

// 淡入淡出控制元素
const fadeToggle = document.getElementById('fadeToggle');
const fadeDuration = document.getElementById('fadeDuration');
const fadeDurationSection = document.getElementById('fadeDurationSection');

let currentFile = null;
let currentBuffer = null;
let duration = 0;
let previewWatcher = null;
let objectUrl = null;
let clipObjectUrl = null;
let ffmpeg = null;
let ffmpegReady = false;
let ffmpegLib = null;
let createFFmpegFn = null;
let fetchFileFn = null;
let ffmpegScriptPromise = null;

// Web Audio API 变量
let audioContext = null;
let sourceNode = null;
let gainNode = null;
let isWebAudioConnected = false;

const defaultBundles = [
  {
    name: 'jsdelivr-01215-umd',
    script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.js',
  },
  {
    name: 'unpkg-0126',
    script: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js',
    corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
  },
  {
    name: 'jsdelivr-0126',
    script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/dist/ffmpeg.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js',
  },
  {
    name: 'unpkg-0125',
    script: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.5/dist/ffmpeg.min.js',
    corePath: 'https://unpkg.com/@ffmpeg/core@0.12.5/dist/ffmpeg-core.js',
  },
  {
    name: 'jsdelivr-0125',
    script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.5/dist/ffmpeg.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.5/dist/ffmpeg-core.js',
  },
  {
    name: 'unpkg-0117',
    script: 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.7/dist/ffmpeg.min.js',
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.7/dist/ffmpeg-core.js',
  },
  {
    name: 'jsdelivr-0117',
    script: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.7/dist/ffmpeg.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.7/dist/ffmpeg-core.js',
  },
];
const runtimeFFmpegConfig = window.__LIQUID_CUT_FFMPEG__ || {};
const customBundles = Array.isArray(runtimeFFmpegConfig.bundles)
  ? runtimeFFmpegConfig.bundles
      .map((bundle, index) => {
        if (!bundle || !bundle.script || !bundle.corePath) return null;
        return {
          name: bundle.name || `custom-${index}`,
          script: bundle.script,
          corePath: bundle.corePath,
        };
      })
      .filter(Boolean)
  : [];
const ffmpegBundles = customBundles.length ? customBundles : defaultBundles;
let activeBundle = ffmpegBundles[0] || defaultBundles[0];
if (runtimeFFmpegConfig.corePath && activeBundle) {
  activeBundle = { ...activeBundle, corePath: runtimeFFmpegConfig.corePath };
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ffmpeg-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error(`无法加载脚本: ${src}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.type = 'text/javascript';
    script.dataset.ffmpegSrc = src;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => {
        script.remove();
        reject(new Error(`无法加载脚本: ${src}`));
      },
      { once: true }
    );
    document.head.appendChild(script);
  });
}

function resolveCorePath(bundle) {
  if (runtimeFFmpegConfig.corePath) return runtimeFFmpegConfig.corePath;
  if (bundle.corePath) return bundle.corePath;
  const scriptUrl = bundle.script || '';
  if (scriptUrl.includes('/dist/umd/')) {
    return scriptUrl.replace('/ffmpeg.min.js', '/ffmpeg-core.js');
  }
  if (scriptUrl.endsWith('.min.js')) {
    return scriptUrl
      .replace('@ffmpeg/ffmpeg', '@ffmpeg/core')
      .replace('ffmpeg.min.js', 'ffmpeg-core.js');
  }
  return 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.15/dist/umd/ffmpeg-core.js';
}

async function loadFFmpegScript() {
  if (window.FFmpeg) {
    return;
  }
  if (ffmpegScriptPromise) {
    return ffmpegScriptPromise;
  }
  ffmpegScriptPromise = (async () => {
    let lastError = null;
    const attempted = [];
    for (const bundle of ffmpegBundles) {
      attempted.push(bundle.name || bundle.script);
      try {
        showStatus(`正在尝试加载转码引擎（来源：${bundle.name || 'unknown'}）…`);
        await loadExternalScript(bundle.script);
        if (window.FFmpegWASM || window.FFmpeg) {
          activeBundle = runtimeFFmpegConfig.corePath
            ? { ...bundle, corePath: runtimeFFmpegConfig.corePath }
            : bundle;
          return;
        }
        lastError = new Error('FFmpeg 库未正确加载');
      } catch (error) {
        lastError = error;
      }
    }
    const error = lastError || new Error('FFmpeg 脚本加载失败');
    error.triedSources = attempted;
    throw error;
  })();
  try {
    await ffmpegScriptPromise;
  } catch (error) {
    if (!error.triedSources && ffmpegBundles.length) {
      error.triedSources = ffmpegBundles.map((bundle) => bundle.name || bundle.script);
    }
    throw error;
  } finally {
    ffmpegScriptPromise = null;
  }
}

async function ensureFFmpeg() {
  if (ffmpegReady) return;

  showStatus('正在加载转码引擎，请稍候…');

  if (!ffmpegLib) {
    try {
      await loadFFmpegScript();
    } catch (error) {
      const attempts = Array.isArray(error?.triedSources) ? error.triedSources.join('，') : '';
      if (attempts) {
        showStatus(`无法加载转码引擎，请检查网络或配置备用镜像（尝试：${attempts}）。`);
      } else {
        showStatus('无法加载转码引擎，请检查网络后重试。');
      }
      throw error;
    }
    ffmpegLib = window.FFmpegWASM || window.FFmpeg;
    if (!ffmpegLib) {
      const err = new Error('FFmpeg library not available');
      showStatus('无法初始化转码引擎，请刷新页面后重试。');
      throw err;
    }
    // 新版本 API 处理
    if (window.FFmpegWASM) {
      createFFmpegFn = () => new ffmpegLib.FFmpeg();
      fetchFileFn = async (file) => {
        const buffer = await file.arrayBuffer();
        return new Uint8Array(buffer);
      };
    } else {
      ({ createFFmpeg: createFFmpegFn, fetchFile: fetchFileFn } = ffmpegLib);
    }
  }

  if (!ffmpeg) {
    const bundle = activeBundle || ffmpegBundles[0];
    const corePath = resolveCorePath(bundle);
    
    if (window.FFmpegWASM) {
      // 新版本 API
      ffmpeg = createFFmpegFn();
      ffmpeg.on('progress', ({ progress }) => {
        if (!statusBar.hidden) {
          const percent = Math.min(100, Math.round(progress * 100));
          statusBar.textContent = `转码进度：${percent}%`;
        }
      });
    } else {
      // 旧版本 API
      ffmpeg = createFFmpegFn({
        log: false,
        corePath,
        progress: ({ ratio }) => {
          if (!statusBar.hidden) {
            const percent = Math.min(100, Math.round(ratio * 100));
            statusBar.textContent = `转码进度：${percent}%`;
          }
        },
      });
    }
  }

  try {
    if (window.FFmpegWASM) {
      // 新版本需要传递 coreURL 和 wasmURL
      const bundle = activeBundle || ffmpegBundles[0];
      const corePath = resolveCorePath(bundle);
      const baseURL = corePath.substring(0, corePath.lastIndexOf('/'));
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });
    } else {
      await ffmpeg.load();
    }
  } catch (error) {
    showStatus('转码引擎加载失败，请稍后重试。');
    throw error;
  }

  ffmpegReady = true;
  hideStatus();
}

// Web Audio API 初始化
function initWebAudio() {
  if (isWebAudioConnected || !audioPlayer.src) return;
  
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // 如果之前的源节点存在，先断开连接
    if (sourceNode) {
      sourceNode.disconnect();
    }
    if (gainNode) {
      gainNode.disconnect();
    }
    
    // 创建新的源节点和增益节点
    sourceNode = audioContext.createMediaElementSource(audioPlayer);
    gainNode = audioContext.createGain();
    
    // 连接音频链
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    isWebAudioConnected = true;
  } catch (error) {
    console.warn('Web Audio API初始化失败:', error);
    isWebAudioConnected = false;
  }
}

// 获取淡入淡出设置
function getFadeSettings() {
  const isEnabled = fadeToggle.checked;
  const maxDuration = parseFloat(fadeDuration.value);
  return { isEnabled, maxDuration };
}

// 计算实际淡入淡出时长
function calculateFadeTime(clipLength, maxDuration) {
  return Math.min(maxDuration, clipLength / 4);
}

function showStatus(message) {
  statusBar.hidden = false;
  statusBar.textContent = message;
}

function hideStatus() {
  statusBar.hidden = true;
  statusBar.textContent = '';
}

function resetSelection() {
  startSlider.value = 0;
  endSlider.value = Math.min(MAX_CLIP_SECONDS, duration);
  syncLabels();
  exportBtn.disabled = true;
  downloadSection.hidden = true;
}

function syncLabels() {
  const start = parseFloat(startSlider.value);
  const end = parseFloat(endSlider.value);
  const clippedStart = Math.min(start, end);
  const clippedEnd = Math.max(start, end);
  const clipLength = Math.max(0, clippedEnd - clippedStart);

  startLabel.textContent = formatTime(clippedStart);
  endLabel.textContent = formatTime(clippedEnd);
  lengthLabel.textContent = formatTime(clipLength);

  exportBtn.disabled = clipLength <= 0;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function clampSelection(changedSlider) {
  let start = parseFloat(startSlider.value);
  let end = parseFloat(endSlider.value);

  if (start > end) {
    if (changedSlider === startSlider) {
      end = start;
    } else {
      start = end;
    }
  }

  start = Math.max(0, Math.min(start, duration));
  end = Math.max(0, Math.min(end, duration));

  let clipLength = end - start;
  if (clipLength > MAX_CLIP_SECONDS) {
    if (changedSlider === startSlider) {
      start = end - MAX_CLIP_SECONDS;
    } else {
      end = start + MAX_CLIP_SECONDS;
    }
    clipLength = MAX_CLIP_SECONDS;
  }

  startSlider.value = start;
  endSlider.value = end;
  syncLabels();
}

function attachPreviewWatcher(start, end) {
  clearPreviewWatcher();
  
  // 获取淡入淡出设置
  const { isEnabled, maxDuration } = getFadeSettings();
  
  if (!isEnabled) {
    // 如果淡入淡出被禁用，使用简单的预听逻辑
    previewWatcher = () => {
      if (audioPlayer.currentTime >= end) {
        audioPlayer.pause();
        audioPlayer.removeEventListener('timeupdate', previewWatcher);
        previewWatcher = null;
      }
    };
    audioPlayer.addEventListener('timeupdate', previewWatcher);
    return;
  }
  
  // 计算淡入淡出时长
  const clipLength = end - start;
  const fadeTime = calculateFadeTime(clipLength, maxDuration);
  const fadeOutStartTime = end - fadeTime;
  
  previewWatcher = () => {
    const currentTime = audioPlayer.currentTime;
    
    // 如果有Web Audio API支持，控制音量淡入淡出
    if (isWebAudioConnected && gainNode && audioContext) {
      // 淡入效果
      if (currentTime <= start + fadeTime) {
        const fadeProgress = Math.max(0, (currentTime - start) / fadeTime);
        gainNode.gain.value = Math.min(1, fadeProgress);
      }
      // 淡出效果
      else if (currentTime >= fadeOutStartTime) {
        const fadeProgress = Math.max(0, (end - currentTime) / fadeTime);
        gainNode.gain.value = Math.max(0, fadeProgress);
      }
      // 正常音量
      else {
        gainNode.gain.value = 1;
      }
    }
    
    // 到达结束时间时停止播放
    if (currentTime >= end) {
      audioPlayer.pause();
      if (isWebAudioConnected && gainNode) {
        gainNode.gain.value = 1; // 恢复正常音量
      }
      audioPlayer.removeEventListener('timeupdate', previewWatcher);
      previewWatcher = null;
    }
  };
  
  audioPlayer.addEventListener('timeupdate', previewWatcher);
}

function clearPreviewWatcher() {
  if (previewWatcher) {
    audioPlayer.removeEventListener('timeupdate', previewWatcher);
    previewWatcher = null;
  }
  // 恢复正常音量
  if (isWebAudioConnected && gainNode) {
    gainNode.gain.value = 1;
  }
}

async function handleFile(file) {
  currentFile = file;
  currentBuffer = null;
  downloadSection.hidden = true;

  // 重置Web Audio API连接状态
  isWebAudioConnected = false;
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }

  if (clipObjectUrl) {
    URL.revokeObjectURL(clipObjectUrl);
    clipObjectUrl = null;
  }

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  // 如果 FFmpeg 已加载，清理之前的输入文件
  if (ffmpeg && ffmpegReady) {
    try {
      const oldInputName = getInputName(currentFile.name);
      if (window.FFmpegWASM) {
        // 清理所有可能的输入文件
        const extensions = ['flac', 'mp3', 'bin'];
        for (const ext of extensions) {
          try {
            await ffmpeg.deleteFile(`input.${ext}`);
          } catch (error) {
            /* ignore */
          }
        }
      } else {
        // 旧版本 API
        const extensions = ['flac', 'mp3', 'bin'];
        for (const ext of extensions) {
          try {
            ffmpeg.FS('unlink', `input.${ext}`);
          } catch (error) {
            /* ignore */
          }
        }
      }
    } catch (error) {
      /* ignore cleanup errors */
    }
  }

  objectUrl = URL.createObjectURL(file);
  audioPlayer.src = objectUrl;
  audioPlayer.load();

  trackNameEl.textContent = file.name || '未命名文件';

  playerSection.hidden = false;
  rangeSection.hidden = true;
  exportBtn.disabled = true;
  showStatus('正在读取音频…');
}

audioPlayer.addEventListener('loadedmetadata', () => {
  duration = audioPlayer.duration;
  trackDurationEl.textContent = formatTime(duration);

  startSlider.max = duration;
  endSlider.max = duration;

  resetSelection();
  rangeSection.hidden = false;
  hideStatus();
});

audioPlayer.addEventListener('ended', clearPreviewWatcher);

audioInput.addEventListener('change', (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  if (!/\.(flac|mp3)$/i.test(file.name ?? '')) {
    showStatus('仅支持上传 FLAC 或 MP3 文件');
    return;
  }
  handleFile(file);
});

[startSlider, endSlider].forEach((slider) => {
  slider.addEventListener('input', (event) => {
    clampSelection(event.target);
  });
  slider.addEventListener('change', () => {
    clearPreviewWatcher();
  });
});

previewBtn.addEventListener('click', () => {
  const start = Math.min(parseFloat(startSlider.value), parseFloat(endSlider.value));
  const end = Math.max(parseFloat(startSlider.value), parseFloat(endSlider.value));
  if (end - start <= 0) return;
  
  // 获取淡入淡出设置
  const { isEnabled } = getFadeSettings();
  
  // 只有在启用淡入淡出时才初始化Web Audio
  if (isEnabled) {
    initWebAudio();
    // 设置初始音量为0（准备淡入）
    if (isWebAudioConnected && gainNode) {
      gainNode.gain.value = 0;
    }
  }
  
  audioPlayer.currentTime = start;
  audioPlayer.play();
  attachPreviewWatcher(start, end);
});

exportBtn.addEventListener('click', async () => {
  try {
    const start = Math.min(parseFloat(startSlider.value), parseFloat(endSlider.value));
    const end = Math.max(parseFloat(startSlider.value), parseFloat(endSlider.value));
    let clipLength = end - start;

    if (clipLength <= 0) {
      showStatus('请选择有效的剪辑区间');
      return;
    }

    await ensureFFmpeg();

    if (!currentBuffer) {
      if (window.FFmpegWASM) {
        // 新版本直接使用 File API
        const arrayBuffer = await currentFile.arrayBuffer();
        currentBuffer = new Uint8Array(arrayBuffer);
      } else {
        currentBuffer = await fetchFileFn(currentFile);
      }
    }

    const inputName = getInputName(currentFile.name);
    const outputName = `clip-${Date.now()}.mp3`;

    // 处理文件系统 API 的差异
    if (window.FFmpegWASM) {
      // 新版本 API
      // 先尝试删除输出文件（防止重名）
      try {
        await ffmpeg.deleteFile(outputName);
      } catch (error) {
        /* ignore */
      }
      
      // 检查输入文件是否已存在
      let inputFileExists = false;
      try {
        await ffmpeg.readFile(inputName);
        inputFileExists = true;
      } catch (error) {
        inputFileExists = false;
      }
      
      // 只有不存在时才写入
      if (!inputFileExists) {
        await ffmpeg.writeFile(inputName, currentBuffer);
      }
    } else {
      // 旧版本 API
      try {
        ffmpeg.FS('unlink', outputName);
      } catch (error) {
        /* ignore */
      }
      
      // 检查输入文件是否存在
      let inputFileExists = false;
      try {
        ffmpeg.FS('stat', inputName);
        inputFileExists = true;
      } catch (error) {
        inputFileExists = false;
      }
      
      // 只有不存在时才写入
      if (!inputFileExists) {
        ffmpeg.FS('writeFile', inputName, currentBuffer);
      }
    }

    showStatus('正在截取并转码为 MP3…');

    // 获取淡入淡出设置
    const { isEnabled, maxDuration } = getFadeSettings();
    
    let args;
    if (isEnabled) {
      // 启用淡入淡出：添加音频滤镜
      const fadeTime = calculateFadeTime(clipLength, maxDuration);
      const fadeOutStart = Math.max(0, clipLength - fadeTime);
      
      args = [
        '-ss', start.toFixed(3),
        '-t', clipLength.toFixed(3),
        '-i', inputName,
        '-af', `afade=in:st=0:d=${fadeTime.toFixed(3)},afade=out:st=${fadeOutStart.toFixed(3)}:d=${fadeTime.toFixed(3)}`,
        '-acodec', 'libmp3lame',
        '-b:a', '192k',
        '-ar', '44100',
        '-y',
        outputName
      ];
    } else {
      // 禁用淡入淡出：不添加音频滤镜
      args = [
        '-ss', start.toFixed(3),
        '-t', clipLength.toFixed(3),
        '-i', inputName,
        '-acodec', 'libmp3lame',
        '-b:a', '192k',
        '-ar', '44100',
        '-y',
        outputName
      ];
    }

    if (window.FFmpegWASM) {
      // 新版本 API
      await ffmpeg.exec(args);
    } else {
      // 旧版本 API
      await ffmpeg.run(...args);
    }

    // 读取输出文件
    let data;
    if (window.FFmpegWASM) {
      // 新版本 API
      data = await ffmpeg.readFile(outputName);
    } else {
      // 旧版本 API
      data = ffmpeg.FS('readFile', outputName);
    }
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });

    if (clipObjectUrl) {
      URL.revokeObjectURL(clipObjectUrl);
    }

    const clipUrl = URL.createObjectURL(blob);
    clipObjectUrl = clipUrl;
    downloadLink.href = clipUrl;
    downloadLink.download = outputName;
    downloadSection.hidden = false;
    showStatus('转换完成，点击下方按钮下载剪辑文件。');

    // 只清理输出文件，保留输入文件以供多次导出
    try {
      if (window.FFmpegWASM) {
        await ffmpeg.deleteFile(outputName);
      } else {
        ffmpeg.FS('unlink', outputName);
      }
    } catch (error) {
      /* ignore cleanup errors */
    }
  } catch (error) {
    console.error(error);
    const message = (error && error.message) || '';
    const lower = message.toLowerCase();
    const attempts = Array.isArray(error?.triedSources) ? error.triedSources.join('，') : '';
    const currentMsg = statusBar.textContent || '';
    const shouldOverride =
      !currentMsg || currentMsg.includes('正在') || currentMsg.includes('转换完成');

    if (attempts && shouldOverride) {
      showStatus(`无法加载转码引擎，请检查网络或配置备用镜像（尝试：${attempts}）。`);
      return;
    }

    if (
      lower.includes('ffmpeg') ||
      lower.includes('script') ||
      lower.includes('脚本') ||
      lower.includes('network') ||
      lower.includes('core')
    ) {
      if (shouldOverride) {
        showStatus('无法加载转码引擎，请检查网络连接后重试。');
      }
    } else if (shouldOverride) {
      showStatus('处理音频时出现问题，请重试或更换文件。');
    }
  }
});

function getInputName(filename = 'input.mp3') {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'flac':
      return 'input.flac';
    case 'mp3':
      return 'input.mp3';
    default:
      return 'input.bin';
  }
}

uploadArea.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadArea.classList.add('drag-hover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-hover');
});

uploadArea.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadArea.classList.remove('drag-hover');
  const [file] = event.dataTransfer?.files || [];
  if (!file) return;
  if (!/\.(flac|mp3)$/i.test(file.name ?? '')) {
    showStatus('仅支持上传 FLAC 或 MP3 文件');
    return;
  }
  handleFile(file);
});

// 淡入淡出控制事件监听器
fadeToggle.addEventListener('change', () => {
  fadeDurationSection.style.display = fadeToggle.checked ? 'flex' : 'none';
});

// 初始化淡入淡出控制显示状态
fadeDurationSection.style.display = fadeToggle.checked ? 'flex' : 'none';

window.addEventListener('beforeunload', () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
  if (clipObjectUrl) {
    URL.revokeObjectURL(clipObjectUrl);
  }
  clearPreviewWatcher();
});

// 提示图标交互
const infoIcon = document.getElementById('infoIcon');
const infoTooltip = document.getElementById('infoTooltip');
const tooltipClose = document.getElementById('tooltipClose');

if (infoIcon && infoTooltip && tooltipClose) {
  infoIcon.addEventListener('click', (e) => {
    e.preventDefault();
    infoTooltip.hidden = false;
  });

  tooltipClose.addEventListener('click', () => {
    infoTooltip.hidden = true;
  });

  // 点击弹窗外部关闭
  infoTooltip.addEventListener('click', (e) => {
    if (e.target === infoTooltip) {
      infoTooltip.hidden = true;
    }
  });
}
