'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordExpense, RecordExpenseOutput } from '@/ai/flows/voice-expense-recording';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error' | 'permission_denied';

interface VoiceExpenseRecorderProps {
  onTranscriptionComplete: (result: RecordExpenseOutput) => void;
}

export function VoiceExpenseRecorder({ onTranscriptionComplete }: VoiceExpenseRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const t = useTranslations('voiceRecording');
  const tCommon = useTranslations('common');

  const handleStopRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.warn("No audio data recorded.");
      setRecordingState('idle');
      return;
    }

    setRecordingState('transcribing');

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioBuffer = await audioBlob.arrayBuffer();
      const audioArray = new Uint8Array(audioBuffer);

      // Convert to base64 data URI as expected by the flow
      const base64Audio = btoa(String.fromCharCode(...audioArray));
      const audioDataUri = `data:audio/webm;base64,${base64Audio}`;
      const result = await recordExpense({ audioDataUri });
      
      onTranscriptionComplete(result);
      setRecordingState('idle');
      audioChunksRef.current = [];

    } catch (error) {
      console.error('Transcription error:', error);
      setRecordingState('error');
      toast({
        variant: "destructive",
        title: t("transcriptionFailed"),
        description: t("transcriptionFailedDescription"),
      });
    }
  }, [onTranscriptionComplete, toast, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setRecordingState('recording');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStopRecording;
      
      mediaRecorder.start(1000); // Collect data every second
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setRecordingState('permission_denied');
      toast({
        variant: "destructive",
        title: t("microphoneAccessDenied"),
        description: t("microphoneAccessDeniedDescription"),
      });
    }
  }, [handleStopRecording, toast, t]);

  const handleButtonClick = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'idle' || recordingState === 'error') {
      startRecording();
    }
  };

  const getButtonText = () => {
    switch(recordingState) {
        case 'recording': return tCommon('stopRecording');
        case 'transcribing': return tCommon('transcribing');
        case 'error': return tCommon('tryAgain');
        case 'permission_denied': return tCommon('permissionDenied');
        default: return tCommon('startRecording');
    }
  };

  const getButtonVariant = () => {
    switch(recordingState) {
      case 'recording': return 'destructive' as const;
      case 'error': return 'outline' as const;
      case 'permission_denied': return 'secondary' as const;
      default: return 'default' as const;
    }
  };

  const isDisabled = recordingState === 'transcribing' || recordingState === 'permission_denied';

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border border-blue-200 dark:border-slate-600">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Voice Expense Recorder
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Tap and speak to record your expense
        </p>
      </div>
      
      <Button
        onClick={handleButtonClick}
        disabled={isDisabled}
        variant={getButtonVariant()}
        size="lg"
        className="w-32 h-32 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
      >
        <div className="flex flex-col items-center gap-2">
          {recordingState === 'transcribing' ? 
            <Loader className="h-8 w-8 animate-spin" /> :
          recordingState === 'recording' ?
            <Square className="h-8 w-8" /> :
            <Mic className="h-8 w-8" />}
          <span className="text-xs font-medium">{getButtonText()}</span>
        </div>
      </Button>
      
      {recordingState === 'error' && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Recording failed. Please try again.</span>
        </div>
      )}
    </div>
  );
}
