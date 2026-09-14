import 'package:flutter/material.dart';
import 'screens/exam_upload_screen.dart';

void main() => runApp(const NotaAiApp());

class NotaAiApp extends StatelessWidget {
  const NotaAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NotaAI',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const ExamUploadScreen(),
    );
  }
}