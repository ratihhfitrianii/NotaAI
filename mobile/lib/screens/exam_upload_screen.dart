import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'services/photo_quality_validator.dart';

/// Layar ujian NotaAI — alur PRD §1:
/// 1. Ambil/gambar foto jawaban.
/// 2. Pra-validasi kualitas (blur/gelap) lokal.
/// 3. (Di sini hanya demo) kirim ke server; produksi: upload ke Supabase Storage
///    lalu panggil Edge Function producer (lihat README).
class ExamUploadScreen extends StatefulWidget {
  const ExamUploadScreen({super.key});

  @override
  State<ExamUploadScreen> createState() => _ExamUploadScreenState();
}

class _ExamUploadScreenState extends State<ExamUploadScreen> {
  final _picker = ImagePicker();
  String? _status;
  bool _busy = false;
  String _subject = 'matematika';
  String _imageUrl = '';

  Future<void> _pickAndValidate() async {
    setState(() => _busy = true);
    try {
      final picked = await _picker.pickImage(source: ImageSource.camera, imageQuality: 90);
      if (picked == null) {
        setState(() => _busy = false);
        return;
      }
      final bytes = await picked.readAsBytes();
      final image = await decodeImage(bytes);
      final error = PhotoQualityValidator.validate(image);
      if (error != null) {
        setState(() {
          _status = error;
          _busy = false;
        });
        return;
      }
      setState(() {
        _status = 'Kualitas foto OK ✓';
        _busy = false;
        _imageUrl = 'https://example.com/uploads/${picked.name}';
      });
      // Produksi: upload bytes ke Supabase Storage → dapatkan URL → panggil Edge Function.
      await _submitToEdgeFunction();
    } catch (e) {
      setState(() {
        _status = 'Gagal memproses foto: $e';
        _busy = false;
      });
    }
  }

  Future<void> _submitToEdgeFunction() async {
    // Endpoint Edge Function producer (PRD §4) — ganti dengan URL Supabase Anda.
    const endpoint = String.fromEnvironment('EDGE_FUNCTION_URL', defaultValue: 'http://localhost:54321/functions/v1/edge-function');
    final res = await http.post(
      Uri.parse(endpoint),
      headers: {'Content-Type': 'application/json'},
      body: '{"documentId":"doc-${DateTime.now().millisecondsSinceEpoch}","imageUrl":"$_imageUrl","subjectType":"$_subject"}'
    );
    if (!mounted) return;
    setState(() => _status = res.statusCode == 202 ? 'Terkirim ke antrean ✓' : 'Gagal kirim: ${res.statusCode}');
  }

  Future<ui.Image> decodeImage(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    return frame.image;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('NotaAI — Ujian')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              value: _subject,
              items: const [
                DropdownMenuItem(value: 'matematika', child: Text('Matematika')),
                DropdownMenuItem(value: 'mandarin', child: Text('Bahasa Mandarin')),
                DropdownMenuItem(value: 'inggris', child: Text('Bahasa Inggris')),
              ],
              onChanged: (v) => setState(() => _subject = v ?? 'matematika'),
              decoration: const InputDecoration(labelText: 'Subjek ujian'),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _busy ? null : _pickAndValidate,
              icon: const Icon(Icons.camera_alt),
              label: Text(_busy ? 'Memproses…' : 'Ambil Foto Jawaban'),
            ),
            const SizedBox(height: 16),
            if (_status != null) ...[
              Text(_status!, style: const TextStyle(fontSize: 16)),
              const SizedBox(height: 8),
            ],
            // Repositori hasil (produksi: dari Supabase). Tampilkan contoh.
            const Divider(height: 32),
            const Text('Hasil koreksi (demo)',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Card(
              child: ListTile(
                leading: Icon(Icons.check_circle, color: Colors.green),
                title: Text('Matematika — skor 86'),
                subtitle: Text('OCR Mathpix → LaTeX; 2/2 langkah cocok'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}