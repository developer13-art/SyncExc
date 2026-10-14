import { useState } from 'react';
import { Mail, MessageSquare, Send } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import { useToast } from '../../hooks/useToast.js';
import { isValidEmail } from '../../lib/validators/email.validator.js';
import { APP } from '../../lib/constants/app.constants.js';

export default function Contact() {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) {
      next.name = 'Please enter your name';
    }
    if (!form.email.trim()) {
      next.email = 'Please enter your email address';
    } else if (!isValidEmail(form.email)) {
      next.email = 'Please enter a valid email address';
    }
    if (!form.subject.trim()) {
      next.subject = 'Please enter a subject';
    }
    if (!form.message.trim()) {
      next.message = 'Please enter a message';
    } else if (form.message.trim().length < 20) {
      next.message = 'Please provide at least 20 characters';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      // Contact uses a mailto fallback since there is no dedicated public endpoint.
      const subject = encodeURIComponent(`[Contact] ${form.subject}`);
      const body = encodeURIComponent(
        `From: ${form.name} <${form.email}>\n\n${form.message}`,
      );
      window.location.href = `mailto:${APP.SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

      toast.success('Email client opened', {
        description: 'If nothing happened, please email us directly.',
      });

      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      toast.error('Unable to open your email client', {
        description: `Please email us at ${APP.SUPPORT_EMAIL}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Contact us
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          For account-specific issues, please use the in-app Support Portal so your request
          includes the correct context and authorization.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="p-6 pt-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormError>
                  {Object.keys(errors).length > 0
                    ? 'Please correct the highlighted fields and try again.'
                    : null}
                </FormError>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Your name" htmlFor="contact-name" required error={errors.name}>
                    <Input
                      id="contact-name"
                      value={form.name}
                      onChange={(e) => updateField('name')(e.target.value)}
                      placeholder="Jane Doe"
                      error={errors.name}
                    />
                  </FormField>

                  <FormField
                    label="Email address"
                    htmlFor="contact-email"
                    required
                    error={errors.email}
                  >
                    <Input
                      id="contact-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email')(e.target.value)}
                      placeholder="you@example.com"
                      error={errors.email}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Subject"
                  htmlFor="contact-subject"
                  required
                  error={errors.subject}
                >
                  <Input
                    id="contact-subject"
                    value={form.subject}
                    onChange={(e) => updateField('subject')(e.target.value)}
                    placeholder="How can we help?"
                    error={errors.subject}
                  />
                </FormField>

                <FormField
                  label="Message"
                  htmlFor="contact-message"
                  required
                  error={errors.message}
                  hint="Please avoid sharing passwords, API secrets, or private keys."
                >
                  <Textarea
                    id="contact-message"
                    rows={6}
                    value={form.message}
                    onChange={(e) => updateField('message')(e.target.value)}
                    placeholder="Describe your question or request…"
                    error={errors.message}
                  />
                </FormField>

                <div className="flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    <Send className="h-4 w-4" />
                    {submitting ? 'Opening…' : 'Send message'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-6 pt-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Email</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                For general enquiries:
              </p>
              <a
                href={`mailto:${APP.SUPPORT_EMAIL}`}
                className="mt-1 block text-sm text-primary hover:underline"
              >
                {APP.SUPPORT_EMAIL}
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 pt-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Support Portal</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                For account-specific issues, sign in and open a ticket. The Support Portal
                routes your request to the correct team with the necessary context.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 pt-6">
              <h3 className="text-sm font-semibold text-foreground">Security reports</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Report a suspected security issue to:
              </p>
              <a
                href={`mailto:${APP.SECURITY_EMAIL}`}
                className="mt-1 block text-sm text-primary hover:underline"
              >
                {APP.SECURITY_EMAIL}
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}