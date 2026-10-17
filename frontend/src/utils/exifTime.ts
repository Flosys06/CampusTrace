/**
 * Safely parses EXIF DateTimeOriginal or DateTime from an image File or Blob.
 * Returns formatted time string (e.g. "10:30 AM") or null if not found.
 */
export async function getExifTimeFromFile(file: File | Blob): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 16 || view.getUint16(0) !== 0xffd8) return null; // Only JPEG supports standard APP1 EXIF

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 Marker
        offset += 2; // skip length
        if (offset + 6 > view.byteLength) return null;
        const exifHeader = String.fromCharCode(
          view.getUint8(offset),
          view.getUint8(offset + 1),
          view.getUint8(offset + 2),
          view.getUint8(offset + 3)
        );
        if (exifHeader !== 'Exif') return null;

        const tiffOffset = offset + 6;
        if (tiffOffset + 8 > view.byteLength) return null;
        const littleEndian = view.getUint16(tiffOffset) === 0x4949;
        const ifd0Offset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
        if (ifd0Offset + 2 > view.byteLength) return null;

        const ifdEntries = view.getUint16(ifd0Offset, littleEndian);
        let exifSubIfdOffset: number | null = null;
        let dateStr: string | null = null;

        for (let i = 0; i < ifdEntries; i++) {
          const entryOffset = ifd0Offset + 2 + i * 12;
          if (entryOffset + 12 > view.byteLength) break;
          const tag = view.getUint16(entryOffset, littleEndian);
          if (tag === 0x8769) {
            exifSubIfdOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
            break;
          }
          if (tag === 0x0132) {
            // DateTime in IFD0
            const valOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
            if (valOffset + 19 <= view.byteLength) {
              let s = '';
              for (let c = 0; c < 19; c++) s += String.fromCharCode(view.getUint8(valOffset + c));
              dateStr = s;
            }
          }
        }

        if (exifSubIfdOffset && exifSubIfdOffset + 2 <= view.byteLength) {
          const subEntries = view.getUint16(exifSubIfdOffset, littleEndian);
          for (let i = 0; i < subEntries; i++) {
            const entryOffset = exifSubIfdOffset + 2 + i * 12;
            if (entryOffset + 12 > view.byteLength) break;
            const tag = view.getUint16(entryOffset, littleEndian);
            if (tag === 0x9003 || tag === 0x9004) {
              // DateTimeOriginal or DateTimeDigitized
              const valOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
              if (valOffset + 19 <= view.byteLength) {
                let s = '';
                for (let c = 0; c < 19; c++) s += String.fromCharCode(view.getUint8(valOffset + c));
                dateStr = s;
                break;
              }
            }
          }
        }

        if (dateStr) {
          // Format "YYYY:MM:DD HH:MM:SS" -> "10:30 AM"
          const parts = dateStr.trim().split(' ');
          if (parts.length >= 2) {
            const [hStr, mStr] = parts[1].split(':');
            const h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10);
            if (!isNaN(h) && !isNaN(m)) {
              const period = h >= 12 ? 'PM' : 'AM';
              const displayHour = ((h + 11) % 12) + 1;
              const displayMin = m < 10 ? `0${m}` : `${m}`;
              return `${displayHour}:${displayMin} ${period}`;
            }
          }
        }
        return null;
      } else if ((marker & 0xff00) === 0xff00) {
        if (offset + 2 > view.byteLength) break;
        offset += view.getUint16(offset);
      } else {
        break;
      }
    }
  } catch {
    return null;
  }
  return null;
}
