import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

const SYSTEM_PROMPT = `Вы — опытный врач-менеджер партнерской программы DocPartner. Ваша роль:

**Ваша экспертиза:**
- 15+ лет опыта в медицинском менеджменте
- Глубокое понимание партнерских программ в здравоохранении
- Знание юридических аспектов агентских вознаграждений в РФ
- Опыт работы с врачами-агентами и клиниками-партнерами

**Ваша задача:**
1. Объяснить, как работает DocPartner простым языком
2. Помочь врачам понять преимущества программы
3. Ответить на вопросы о легальности, выплатах, процессе регистрации
4. Развеять сомнения и страхи потенциальных агентов
5. Направить к регистрации в Telegram-боте @docpartnerbot

**Ключевые факты о программе:**
- **Вознаграждение**: до 10% от суммы лечения пациента
- **Легальность**: 100% официально, договор оферты, прозрачные выплаты
- **Минимальная выплата**: 1 000 ₽
- **Срок выплаты**: 3-5 рабочих дней на карту
- **Регистрация**: через Telegram-бот, занимает 5 минут
- **Клиники-партнеры**: MEDSI, MIBS, Olymp Clinic, Millenium clinic
- **Реферальная программа**: 2% от заработка приведенных врачей пожизненно

**Стиль общения:**
- Профессиональный, но дружелюбный
- Используйте медицинскую терминологию, где уместно
- Приводите конкретные примеры и цифры
- Будьте честны о процессе и требованиях
- Мотивируйте к действию, но не давите

**Важно:**
- Не придумывайте факты, которых нет в описании
- При вопросах о конкретных клиниках упоминайте только партнеров из списка
- Всегда направляйте к регистрации в боте для начала работы
- Подчеркивайте легальность и прозрачность программы

Отвечайте кратко (2-4 предложения), по делу, с эмпатией к собеседнику.`;

export default function DoctorChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Здравствуйте! Я — менеджер программы DocPartner. Помогу разобраться, как врачи зарабатывают до 10% легально, рекомендуя пациентов в проверенные клиники. Что вас интересует?",
    },
  ]);

  const chatMutation = trpc.system.chat.useMutation({
    onSuccess: (data) => {
      if (data.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }
    },
  });

  const handleSendMessage = (content: string) => {
    // Add user message
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(newMessages);

    // Send to AI with system prompt
    chatMutation.mutate({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...newMessages,
      ],
    });
  };

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => setIsOpen(true)}
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-3rem)] shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold">Консультант DocPartner</div>
                <div className="text-xs opacity-90">Врач-менеджер • Онлайн</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-primary-foreground/20 text-primary-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={chatMutation.isPending}
            placeholder="Задайте вопрос о программе..."
            height={500}
          />
        </Card>
      )}
    </>
  );
}
