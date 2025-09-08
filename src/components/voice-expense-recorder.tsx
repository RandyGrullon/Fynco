'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordExpense, RecordExpenseOutput } from '@/ai/flows/voice-expense-recording';
import { useToast } from '@/hooks/use-toast';

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error' | 'permission_denied';

interface VoiceExpenseRecorderProps {
  onTranscriptionComplete: (data: RecordExpenseOutput) => void;
}

export function VoiceExpenseRecorder({ onTranscriptionComplete }: VoiceExpenseRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const handleStopRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.warn("No audio data recorded.");
      setRecordingState('idle');
      return;
    }
    setRecordingState('transcribing');
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
    audioChunksRef.current = [];

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      try {
        const result = await recordExpense({ audioDataUri: base64Audio });
        onTranscriptionComplete(result);
        setRecordingState('idle');
      } catch (error) {
        console.error('Transcription error:', error);
        setRecordingState('error');
        toast({
          variant: "destructive",
          title: "Transcription Failed",
          description: "Could not process the audio. Please try again.",
        });
      }
    };
  }, [onTranscriptionComplete, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingState('recording');
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = handleStopRecording;
      
      recorder.start();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setRecordingState('permission_denied');
      toast({
          variant: "destructive",
          title: "Microphone Access Denied",
          description: "Please enable microphone permissions in your browser settings.",
      });
    }
  };

  const handleButtonClick = () => {
    if (recordingState === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getButtonText = () => {
    switch(recordingState) {
        case 'recording': return 'Stop Recording';
        case 'transcribing': return 'Transcribing...';
        case 'error': return 'Try Again';
        case 'permission_denied': return 'Permission Denied';
        default: return 'Start Recording';
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg">
      <div className="relative flex h-24 w-24 items-center justify-center">
        {recordingState === 'recording' && (
          <div className="absolute h-full w-full animate-pulse rounded-full bg-primary/20"></div>
        )}
        <Button
          size="icon"
          className="h-20 w-20 rounded-full"
          onClick={handleButtonClick}
          disabled={recordingState === 'transcribing' || recordingState === 'permission_denied'}
          variant={recordingState === 'recording' ? 'destructive' : 'default'}
        >
          {recordingState === 'transcribing' ? 
            <Loader className="h-8 w-8 animate-spin" /> : 
            recordingState === 'recording' ? 
            <Square className="h-8 w-8" /> : 
            <Mic className="h-8 w-8" />}
        </Button>
      </div>
       <p className="text-sm text-muted-foreground text-center">
        {getButtonText()}
      </p>
      {recordingState === 'permission_denied' && (
        <p className="text-xs text-destructive text-center max-w-xs">
            Fynco needs access to your microphone to record expenses. Please enable it in your browser settings and try again.
        </p>
      )}
       {recordingState === 'idle' && (
        <p className="text-xs text-muted-foreground text-center max-w-xs">
            Press the button and say something like: "Lunch at The Cafe for 15.50 on my credit card yesterday"
        </p>
      )}

    </div>
  );
}
