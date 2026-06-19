document.addEventListener("DOMContentLoaded", () => {
  const mainImage = document.getElementById("mainImage");
  const info = document.getElementById("info");
  const detail = document.getElementById("detail");
  const thumbs = document.querySelectorAll(".thumb");

  // 音声
  let sound = null;
  try {
    sound = new Audio("sounds/click.mp3");
    sound.volume = 0.4;
  } catch (e) {}

  function playSound() {
    if (!sound) return;
    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch (e) {}
  }

  let currentIndex = 0;

  function renderFromThumb(thumb, index) {
    mainImage.classList.remove("fade-in");
    mainImage.classList.add("fade-out");

    setTimeout(() => {
      mainImage.src = thumb.src;
      mainImage.alt = thumb.dataset.label || "";

      // カウンター表示「5 / 11」
      info.innerHTML = `
        <span class="photo-label">${thumb.dataset.label || ""}</span>
        <span class="photo-counter">${index + 1} / ${thumbs.length}</span>
      `;

      detail.innerHTML = `
  <div class="detail-box">
    <strong>時間🕒</strong><span>${thumb.dataset.time || ""}</span>
    <strong>内容📌</strong><span>${thumb.dataset.item || ""}</span>
    <strong>効果✨</strong><span>${thumb.dataset.effect || ""}</span>
  </div>
`;

      mainImage.classList.remove("fade-out");
      mainImage.classList.add("fade-in");
    }, 150);

    playSound();
  }

  function goTo(index) {
    thumbs.forEach(t => t.classList.remove("active"));
    thumbs[index].classList.add("active");

    // サムネイルが見えるようにスクロール
    thumbs[index].scrollIntoView({ block: "nearest", inline: "nearest" });

    currentIndex = index;
    renderFromThumb(thumbs[index], index);
  }

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener("click", () => goTo(index));
  });

  mainImage.addEventListener("click", () => {
    goTo((currentIndex + 1) % thumbs.length);
  });

  // キーボード ← → で切り替え
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goTo((currentIndex + 1) % thumbs.length);
    if (e.key === "ArrowLeft")  goTo((currentIndex - 1 + thumbs.length) % thumbs.length);
  });

  if (thumbs.length > 0) goTo(0);
});

// ===== Before / After 比較スライダー（複数対応・PC/スマホ両対応）=====
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".ba-container").forEach((container) => {
    const beforeWrap = container.querySelector(".ba-before-wrap");
    const beforeImg  = container.querySelector(".ba-before");
    const handle     = container.querySelector(".ba-handle");
    const slider     = container.querySelector(".ba-slider");
    if (!beforeWrap || !beforeImg || !handle) return;

    let percent = slider ? Number(slider.value) : 50;

    const apply = (p) => {
      percent = Math.max(0, Math.min(100, p));
      beforeWrap.style.width = percent + "%";
      handle.style.left = percent + "%";
      // 上画像が縮まないよう、下画像と同じ実寸に固定
      beforeImg.style.width = container.offsetWidth + "px";
      if (slider) slider.value = percent;
    };

    const setFromPointer = (clientX) => {
      const rect = container.getBoundingClientRect();
      apply(((clientX - rect.left) / rect.width) * 100);
    };

    let dragging = false;
    container.addEventListener("pointerdown", (e) => {
      dragging = true;
      container.setPointerCapture(e.pointerId);
      setFromPointer(e.clientX);
    });
    container.addEventListener("pointermove", (e) => {
      if (dragging) setFromPointer(e.clientX);
    });
    const endDrag = () => { dragging = false; };
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);

    // キーボード（range のフォーカス時の矢印キー）
    if (slider) slider.addEventListener("input", () => apply(Number(slider.value)));

    window.addEventListener("resize", () => apply(percent));
    apply(percent);
  });
});
