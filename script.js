// トップへ戻るボタン
window.addEventListener('scroll', () => {
  const btn = document.getElementById('back-to-top');
  if (btn) btn.classList.toggle('visible', window.scrollY > 300);
});

// ハンバーガーメニュー
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.textContent = isOpen ? '✕' : '☰';
    });
  }
});

window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-Q5ZM4M1DXH');

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button, a').forEach(el => {
    el.addEventListener('click', () => {
      gtag('event', 'click', { text: el.innerText, href: el.href || '' });
    });
  });
});

const images = ["car1.jpg", "car2.jpg"];
let currentIndex = 0;

const slideshow = document.getElementById("slideshow");
const mosaic = document.getElementById("mosaic");

let firstTransitionDone = false;

if (mosaic) {
  for (let i = 0; i < 96; i++) {
    const pixel = document.createElement("div");
    pixel.className = "pixel";
    mosaic.appendChild(pixel);
  }
}

function shuffleArray(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function runRandomMosaicTransition(nextImage) {
  if (!mosaic || !slideshow) return;

  const pixels = Array.from(document.querySelectorAll(".pixel"));
  const shuffledPixels = shuffleArray(pixels);

  pixels.forEach((pixel) => {
    pixel.style.opacity = "1";
  });

  slideshow.src = nextImage;

  shuffledPixels.forEach((pixel, index) => {
    setTimeout(() => {
      pixel.style.opacity = "0";
    }, index * 50);
  });
}

function changeImageWithFade() {
  if (!slideshow) return;

  currentIndex = (currentIndex + 1) % images.length;
  const nextImage = images[currentIndex];

  if (!firstTransitionDone) {
    runRandomMosaicTransition(nextImage);
    firstTransitionDone = true;
    return;
  }

  slideshow.style.opacity = "0";

  setTimeout(() => {
    slideshow.src = nextImage;
    slideshow.style.opacity = "1";
  }, 2000);
}

setTimeout(() => {
  changeImageWithFade();
  setInterval(changeImageWithFade, 6000);
}, 5000);