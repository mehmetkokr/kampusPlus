import React, { Suspense, createContext, lazy, useCallback, useContext, useRef, useState } from 'react';

// Fotoğraf yüklemeden önce düzenleyiciyi açar:
//
//   const editPhoto = usePhotoEditor();
//   const edited = await editPhoto(file, { aspects: ['1:1'], title: 'Profil fotoğrafı' });
//   if (!edited) return; // vazgeçildi
//
// Düzenleyici yalnızca ilk açıldığında yüklenir. GIF'ler (animasyon bozulmasın)
// ve görüntü olmayan dosyalar düzenlenmeden olduğu gibi döner.
const PhotoEditor = lazy(() => import('../components/PhotoEditor'));
const PhotoEditorContext = createContext(null);

export function PhotoEditorProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const editPhoto = useCallback((file, options = {}) => {
    if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return Promise.resolve(file);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest({ file, options });
    });
  }, []);

  const close = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const cancel = useCallback(() => close(null), [close]);

  return (
    <PhotoEditorContext.Provider value={editPhoto}>
      {children}
      {request && (
        <Suspense fallback={<div className="pe-overlay" aria-busy="true" />}>
          <PhotoEditor file={request.file} options={request.options} onDone={close} onCancel={cancel} />
        </Suspense>
      )}
    </PhotoEditorContext.Provider>
  );
}

export function usePhotoEditor() {
  const ctx = useContext(PhotoEditorContext);
  if (!ctx) throw new Error('usePhotoEditor, PhotoEditorProvider içinde kullanılmalı');
  return ctx;
}
