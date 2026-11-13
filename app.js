/**
 * Sara Foto Fácil - Lógica Principal (Versão 3)
 * Suporte nativo a fotos em Modo Retrato, HDR (Tone Map) e containers com múltiplas camadas.
 */

// Estado da Aplicação
const state = {
  files: [],
  outputFormat: 'image/jpeg',
  outputExt: 'jpg',
  quality: 0.92,
  isConverting: false
};

// Elementos do DOM
const dropZone = document.getElementById('drop-zone');
const fileInputAll = document.getElementById('file-input-all');
const fileInputGallery = document.getElementById('file-input-gallery');
const btnPickFiles = document.getElementById('btn-pick-files');
const btnPickGallery = document.getElementById('btn-pick-gallery');

const optionsSection = document.getElementById('options-section');
const photosSection = document.getElementById('photos-section');
const photosList = document.getElementById('photos-list');
const photosCountTitle = document.getElementById('photos-count-title');
const btnConvertAll = document.getElementById('btn-convert-all');
const convertBtnText = document.getElementById('convert-btn-text');
const btnClear = document.getElementById('btn-clear');
const btnAddMore = document.getElementById('btn-add-more');
const globalProgress = document.getElementById('global-progress');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const downloadAllContainer = document.getElementById('download-all-container');
const btnDownloadZip = document.getElementById('btn-download-zip');
const formatCards = document.querySelectorAll('.format-card');

const installBanner = document.getElementById('install-banner');
const btnInstall = document.getElementById('btn-install');
const installModal = document.getElementById('install-modal');
const closeModal = document.getElementById('close-modal');
const btnModalOk = document.getElementById('btn-modal-ok');
const iosGuide = document.getElementById('ios-guide');
const closeIosGuide = document.getElementById('close-ios-guide');

// ========================================================
// 1. Inicialização e Instalação PWA Inteligente
// ========================================================

let deferredPrompt = null;
const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

if (isStandalone && installBanner) {
  installBanner.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isStandalone && installBanner) {
    installBanner.classList.remove('hidden');
  }
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        if (installBanner) installBanner.classList.add('hidden');
      }
      deferredPrompt = null;
    } else {
      if (installModal) installModal.classList.remove('hidden');
    }
  });
}

if (closeModal) closeModal.addEventListener('click', () => installModal.classList.add('hidden'));
if (btnModalOk) btnModalOk.addEventListener('click', () => installModal.classList.add('hidden'));

function checkIosGuide() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIos && !isStandalone && iosGuide) {
    if (!sessionStorage.getItem('iosGuideDismissed')) {
      iosGuide.classList.remove('hidden');
    }
  }
}

if (closeIosGuide) {
  closeIosGuide.addEventListener('click', () => {
    iosGuide.classList.add('hidden');
    sessionStorage.setItem('iosGuideDismissed', 'true');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => reg.update())
      .catch((err) => console.log('Service Worker aviso:', err));
  });
}

checkIosGuide();

// ========================================================
// 2. Seleção de Fotos (Arquivos vs Galeria vs Arrastar)
// ========================================================

if (btnPickFiles) {
  btnPickFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputAll.click();
  });
}

if (btnPickGallery) {
  btnPickGallery.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputGallery.click();
  });
}

if (btnAddMore) {
  btnAddMore.addEventListener('click', () => {
    fileInputAll.click();
  });
}

fileInputAll.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInputAll.value = '';
});

fileInputGallery.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInputGallery.value = '';
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-active');
  });
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    handleFiles(dt.files);
  }
});

function handleFiles(fileList) {
  if (!fileList || fileList.length === 0) return;

  const validExtensions = ['heic', 'heif', 'jpg', 'jpeg', 'png', 'webp', 'dng', 'bmp', 'tiff', 'tif', 'avif'];
  const acceptedFiles = [];
  const rejectedNames = [];

  Array.from(fileList).forEach(file => {
    const ext = getExtension(file.name).toLowerCase();
    const isImageByMime = file.type && file.type.startsWith('image/');
    const isImageByExt = validExtensions.includes(ext);

    if (isImageByExt || isImageByMime) {
      acceptedFiles.push(file);
    } else {
      rejectedNames.push(file.name);
    }
  });

  if (rejectedNames.length > 0 && acceptedFiles.length === 0) {
    alert(`O arquivo selecionado (${rejectedNames.join(', ')}) não parece ser uma foto. Por favor, escolha fotos ou imagens.`);
    return;
  }

  acceptedFiles.forEach(file => {
    const ext = getExtension(file.name);
    state.files.push({
      id: 'photo_' + Math.random().toString(36).substr(2, 9),
      file: file,
      name: file.name,
      ext: ext.toUpperCase(),
      originalSize: formatBytes(file.size),
      convertedBlob: null,
      convertedUrl: null,
      status: 'waiting',
      error: null
    });
  });

  updateUI();
}

// ========================================================
// 3. Atualização da Interface (UI)
// ========================================================

function updateUI() {
  const total = state.files.length;

  if (total === 0) {
    optionsSection.classList.add('hidden');
    photosSection.classList.add('hidden');
    downloadAllContainer.classList.add('hidden');
    globalProgress.classList.add('hidden');
    return;
  }

  optionsSection.classList.remove('hidden');
  photosSection.classList.remove('hidden');
  photosCountTitle.textContent = `Fotos Selecionadas (${total})`;

  photosList.innerHTML = '';
  state.files.forEach(item => {
    const el = createPhotoCard(item);
    photosList.appendChild(el);
  });

  const convertedCount = state.files.filter(f => f.status === 'done').length;
  if (convertedCount > 1) {
    downloadAllContainer.classList.remove('hidden');
  } else {
    downloadAllContainer.classList.add('hidden');
  }
}

function createPhotoCard(item) {
  const div = document.createElement('div');
  div.className = 'photo-item';
  div.id = item.id;

  const isHeic = item.ext === 'HEIC' || item.ext === 'HEIF';
  const formatBadgeClass = isHeic ? 'badge-format heic' : 'badge-format';

  let statusBadgeHtml = '';
  let actionHtml = '';

  if (item.status === 'waiting') {
    statusBadgeHtml = `<span class="photo-status-badge status-waiting">Aguardando</span>`;
  } else if (item.status === 'converting') {
    statusBadgeHtml = `<span class="photo-status-badge status-converting"><span class="mini-spinner"></span> Convertendo...</span>`;
  } else if (item.status === 'done') {
    statusBadgeHtml = `<span class="photo-status-badge status-done">✓ Pronta</span>`;
    actionHtml = `<button class="btn-item-download" onclick="downloadSingle('${item.id}')">Baixar</button>`;
  } else if (item.status === 'error') {
    statusBadgeHtml = `<span class="photo-status-badge status-error" title="${item.error || 'Erro'}">Erro</span>`;
  }

  let previewHtml = `<div class="photo-preview">🖼️</div>`;
  if (item.convertedUrl) {
    previewHtml = `<div class="photo-preview"><img src="${item.convertedUrl}" alt="Foto"></div>`;
  }

  div.innerHTML = `
    ${previewHtml}
    <div class="photo-details">
      <div class="photo-name" title="${item.name}">${item.name}</div>
      <div class="photo-meta">
        <span class="${formatBadgeClass}">${item.ext}</span>
        <span class="photo-size">${item.originalSize}</span>
      </div>
    </div>
    <div class="photo-actions-area">
      ${statusBadgeHtml}
      ${actionHtml}
    </div>
  `;

  return div;
}

// ========================================================
// 4. Seleção de Formato (JPG ou PNG)
// ========================================================

formatCards.forEach(card => {
  card.addEventListener('click', () => {
    formatCards.forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const radio = card.querySelector('input[type="radio"]');
    radio.checked = true;

    state.outputFormat = radio.value;
    state.outputExt = radio.value === 'image/jpeg' ? 'jpg' : 'png';
  });
});

btnClear.addEventListener('click', () => {
  state.files.forEach(f => {
    if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
  });
  state.files = [];
  updateUI();
});

// ========================================================
// 5. Motor de Conversão com Suporte Robusto a HDR e Retrato
// ========================================================

btnConvertAll.addEventListener('click', async () => {
  if (state.isConverting || state.files.length === 0) return;

  state.isConverting = true;
  btnConvertAll.disabled = true;
  convertBtnText.textContent = 'Convertendo Fotos...';
  globalProgress.classList.remove('hidden');

  const total = state.files.length;
  let completed = 0;

  for (let i = 0; i < total; i++) {
    const item = state.files[i];

    item.status = 'converting';
    updateSingleCard(item);

    const percent = Math.round(((i) / total) * 100);
    progressBarFill.style.width = `${percent}%`;
    progressText.textContent = `Convertendo foto ${i + 1} de ${total}...`;

    try {
      const convertedBlob = await convertImage(item.file, state.outputFormat, state.quality);
      item.convertedBlob = convertedBlob;
      item.convertedUrl = URL.createObjectURL(convertedBlob);
      item.status = 'done';
    } catch (err) {
      console.error('Erro ao converter foto:', item.name, err);
      item.status = 'error';
      item.error = err.message || 'Erro de leitura';
    }

    completed++;
    updateSingleCard(item);

    await new Promise(resolve => setTimeout(resolve, 20));
  }

  progressBarFill.style.width = '100%';
  progressText.textContent = `Tudo pronto! ${completed} foto(s) processada(s).`;
  state.isConverting = false;
  btnConvertAll.disabled = false;
  convertBtnText.textContent = 'Converter Fotos';

  if (total === 1 && state.files[0].status === 'done') {
    downloadSingle(state.files[0].id);
  } else if (total > 1) {
    downloadAllContainer.classList.remove('hidden');
  }
});

function updateSingleCard(item) {
  const existingCard = document.getElementById(item.id);
  if (!existingCard) return;

  const newCard = createPhotoCard(item);
  existingCard.replaceWith(newCard);
}

/**
 * Converte qualquer foto (inclusive HEIC com Modo Retrato e HDR Tone Map)
 */
async function convertImage(file, targetMime, quality) {
  const ext = getExtension(file.name).toLowerCase();
  const isHeic = ext === 'heic' || ext === 'heif' || 
                 (file.type && (file.type.includes('heic') || file.type.includes('heif')));

  if (isHeic) {
    // Tentativa 1: LibHEIF moderno (suporta containers complexos do iPhone: Tone Map, Gain Map, Modo Retrato)
    if (typeof libheif !== 'undefined' && typeof libheif.HeifDecoder === 'function') {
      try {
        const buffer = await file.arrayBuffer();
        const decoder = new libheif.HeifDecoder();
        const data = decoder.decode(new Uint8Array(buffer));

        if (data && data.length > 0) {
          const image = data[0]; // Foto principal
          const width = image.get_width();
          const height = image.get_height();

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          const imageData = ctx.createImageData(width, height);

          await new Promise((resolve, reject) => {
            image.display(imageData, (displayData) => {
              if (!displayData) return reject(new Error('Falha ao renderizar pixels'));
              resolve(displayData);
            });
          });

          ctx.putImageData(imageData, 0, 0);

          if (typeof image.free === 'function') {
            try { image.free(); } catch (e) {}
          }

          const blobResult = await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Falha ao gerar imagem'));
            }, targetMime, quality);
          });

          if (blobResult) return blobResult;
        }
      } catch (errLibHeif) {
        console.warn('libheif falhou, tentando fallback heic2any com multiple: true:', errLibHeif);
      }
    }

    // Tentativa 2: heic2any com multiple: true (CRUCIAL para fotos com múltiplas camadas/Live/HDR)
    if (typeof heic2any === 'function') {
      try {
        const conversionResult = await heic2any({
          blob: file,
          toType: targetMime,
          quality: quality,
          multiple: true // Permite desempacotar containers com fotos adicionais ou metadados de profundidade
        });

        if (Array.isArray(conversionResult)) {
          return conversionResult[0]; // Pega a foto principal
        }
        return conversionResult;
      } catch (errHeic2AnyMulti) {
        // Tentativa de emergência com multiple: false
        try {
          const singleResult = await heic2any({
            blob: file,
            toType: targetMime,
            quality: quality,
            multiple: false
          });
          return Array.isArray(singleResult) ? singleResult[0] : singleResult;
        } catch (innerErr) {
          throw new Error('Esta foto possui um formato HDR/Retrato não suportado pelo navegador.');
        }
      }
    }

    throw new Error('Bibliotecas de HEIC indisponíveis.');
  }

  // Caso padrão: Outros formatos (JPG, PNG, WebP, etc.)
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (targetMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao processar imagem'));
          }
        }, targetMime, quality);
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler esta foto.'));
    };

    img.src = url;
  });
}

// ========================================================
// 6. Download das Fotos
// ========================================================

window.downloadSingle = function(photoId) {
  const item = state.files.find(f => f.id === photoId);
  if (!item || !item.convertedBlob) return;

  const baseName = removeExtension(item.name);
  const fileName = `${baseName}.${state.outputExt}`;

  triggerDownload(item.convertedBlob, fileName);
};

btnDownloadZip.addEventListener('click', async () => {
  if (typeof JSZip === 'undefined') {
    alert('Preparando arquivo zip... Aguarde 2 segundos.');
    return;
  }

  btnDownloadZip.disabled = true;
  btnDownloadZip.innerHTML = '<span>⏳ Empacotando fotos...</span>';

  try {
    const zip = new JSZip();
    const folder = zip.folder('Sara_Fotos_Prontas');

    state.files.forEach((item) => {
      if (item.status === 'done' && item.convertedBlob) {
        const baseName = removeExtension(item.name);
        const fileName = `${baseName}.${state.outputExt}`;
        folder.file(fileName, item.convertedBlob);
      }
    });

    const zipContent = await zip.generateAsync({ type: 'blob' });
    triggerDownload(zipContent, 'Sara_Fotos_Prontas.zip');
  } catch (err) {
    console.error('Erro ao gerar ZIP:', err);
    alert('Houve um problema ao gerar o arquivo ZIP. Tente baixar individualmente.');
  } finally {
    btnDownloadZip.disabled = false;
    btnDownloadZip.innerHTML = '<span>📦 Baixar Todas as Fotos Prontas (.ZIP)</span>';
  }
});

function triggerDownload(blob, fileName) {
  // Se estiver rodando dentro do app Android nativo (.apk):
  if (window.AndroidApp && typeof window.AndroidApp.saveFile === 'function') {
    const reader = new FileReader();
    reader.onloadend = function() {
      window.AndroidApp.saveFile(reader.result, fileName, blob.type || 'application/octet-stream');
    };
    reader.readAsDataURL(blob);
    return;
  }

  // Se estiver rodando no navegador (Notebook ou Celular via link):
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ========================================================
// Utilitários
// ========================================================

function getExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

function removeExtension(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
