'use client';

import { useState, type ReactNode } from 'react';
import { Bot, Loader2, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { runFinancialAssistantAction } from '../actions';
import type { FinancialReportSnapshot } from '../types';

function renderInlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`)/g).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={`${part}-${index}`} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] dark:bg-white/10">{part.slice(1, -1)}</code>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function AssistantAnswer({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-6">
      {text.split(/\r?\n/).map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`blank-${index}`} className="h-1" aria-hidden="true" />;

        const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
        if (heading) {
          return <p key={`heading-${index}`} className="font-semibold text-foreground">{renderInlineMarkdown(heading[1])}</p>;
        }

        const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={`bullet-${index}`} className="flex gap-2">
              <span className="text-primary" aria-hidden="true">•</span>
              <p className="min-w-0 flex-1">{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        return <p key={`paragraph-${index}`}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

export function FinancialAssistant({ snapshot }: { snapshot: FinancialReportSnapshot }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function execute(mode: 'QUESTION' | 'REPORT_SUMMARY') {
    setPending(true);
    setError(null);
    try {
      const result = await runFinancialAssistantAction({
        mode,
        question: mode === 'QUESTION' ? question : undefined,
        snapshot,
      });
      if (result.ok) setAnswer(result.text);
      else setError(result.error);
    } catch {
      setError('Trợ lý AI tạm thời không khả dụng. Bạn vẫn có thể đọc báo cáo thủ công.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          Trợ lý báo cáo AI
        </CardTitle>
        <CardDescription>
          Chỉ giải thích số liệu trong báo cáo hiện tại; không ghi, sửa hoặc thực hiện giao dịch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
          placeholder="Ví dụ: Vì sao chi tiêu tháng này tăng?"
          aria-label="Câu hỏi cho trợ lý báo cáo"
          className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => execute('QUESTION')} disabled={pending || !question.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <MessageCircleQuestion />}
            Hỏi trợ lý
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => execute('REPORT_SUMMARY')} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Tóm tắt kỳ này
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Khi bấm nút, phần tổng hợp báo cáo sẽ được gửi tới nhà cung cấp AI đã cấu hình để giải thích.
        </p>
        {error && <div className="finora-notice-error rounded-md border px-3 py-2 text-sm" role="alert">{error}</div>}
        {answer && (
          <div className="finora-notice-success rounded-md border px-3 py-3 text-sm" role="status" aria-live="polite">
            <AssistantAnswer text={answer} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
