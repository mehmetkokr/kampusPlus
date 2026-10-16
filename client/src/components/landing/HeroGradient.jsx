import React from 'react';

// Ana sayfanın üst kısmında yavaş dalgalanan renk geçişi.
//
// Önceden WebGL (ShaderGradient) ile çiziliyordu: ~880 KB kodun çözümlenmesi ve
// shader derlemesi ana iş parçacığını ~0,6 sn kilitliyor, geçiş de yüklendiği
// anda koyu zeminden maviye birden atlıyordu. Artık üç yumuşak renk bulutu
// yalnızca transform ile hareket ediyor: tarayıcı bunu ekran kartında, ana iş
// parçacığından bağımsız çalıştırır; ilk kareden itibaren sayfadadır, sonradan
// "belirmez". Renkler logoyla uyumlu (koyu: grafit ve bordo,
// açık: soluk gül ve gri). Hareketi azaltmayı seçenlerde bulutlar durur.
export default function HeroGradient() {
  return (
    <div className="landing-hero-gradient" aria-hidden="true" data-html2canvas-ignore>
      <span className="hg-blob hg-blob-1" />
      <span className="hg-blob hg-blob-2" />
      <span className="hg-blob hg-blob-3" />
    </div>
  );
}
