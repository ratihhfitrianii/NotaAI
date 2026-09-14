import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:image/image.dart' as img;

/// Pra-validasi kualitas foto ujian sebelum dikirim (PRD §1):
/// deteksi blur & gelap secara lokal, agar gambar buruk ditolak lebih awal
/// (hemat kuota OCR & antrean).
class PhotoQualityValidator {
  /// Ambang batas: varians Laplacian di bawah ini dianggap blur.
  static const double blurThreshold = 100.0;
  /// Ambang batas: kecerahan rata-rata di bawah ini dianggap terlalu gelap.
  static const double darknessThreshold = 60.0;

  /// Kembalikan `null` bila kualitas OK; atau pesan alasan ditolak.
  static String? validate(ui.Image image) {
    final bytes = image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (bytes == null) return 'Tidak dapat membaca gambar';

    final width = image.width;
    final height = image.height;
    final data = bytes.buffer.asUint8List();

    // Downsample ke grid (mis. 64x64) untuk kecerahan rata-rata (cepat).
    final gridSize = 64;
    double brightnessSum = 0;
    int count = 0;
    for (int gy = 0; gy < gridSize; gy++) {
      for (int gx = 0; gx < gridSize; gx++) {
        final x = (gx * width) ~/ gridSize;
        final y = (gy * height) ~/ gridSize;
        final i = (y * width + x) * 4;
        final r = data[i], g = data[i + 1], b = data[i + 2];
        brightnessSum += (0.299 * r + 0.587 * g + 0.114 * b);
        count++;
      }
    }
    final avgBrightness = brightnessSum / count;

    if (avgBrightness < darknessThreshold) {
      return 'Foto terlalu gelap (kecerahan ${avgBrightness.toStringAsFixed(0)}). '
          'Mohon perbaiki pencahayaan.';
    }

    // Deteksi blur: konvolusi Laplacian via img.Image (grayscale) pada sampel kecil.
    final sample = img.copyResize(
      img.decodeImage(data)!,
      width: 200,
    );
    final gray = img.grayscale(sample);
    final variance = _laplacianVariance(gray);
    if (variance < blurThreshold) {
      return 'Foto kurang fokus (blur). Mohon ambil ulang dengan fokus lebih tajam.';
    }

    return null;
  }

  static double _laplacianVariance(img.Image gray) {
    final w = gray.width, h = gray.height;
    final kernel = [
      [0, 1, 0],
      [1, -4, 1],
      [0, 1, 0]
    ];
    double sum = 0, sumSq = 0;
    int n = 0;
    for (int y = 1; y < h - 1; y++) {
      for (int x = 1; x < w - 1; x++) {
        double lap = 0;
        for (int ky = -1; ky <= 1; ky++) {
          for (int kx = -1; kx <= 1; kx++) {
            final p = gray.getPixel(x + kx, y + ky);
            lap += p.r * kernel[ky + 1][kx + 1];
          }
        }
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    if (n == 0) return 0;
    final mean = sum / n;
    return (sumSq / n) - (mean * mean);
  }
}