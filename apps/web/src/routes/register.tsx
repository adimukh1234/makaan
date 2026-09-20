import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AuthLayout } from '@/components/layout/auth-layout';
import { api } from '@/lib/api';
import { queryKeys } from '@/hooks/use-api';
import { CONSENT_PURPOSE_LABELS } from '@makaan/core';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(10, 'Use at least 10 characters'),
  role: z.enum(['tenant', 'landlord']),
  service: z.boolean().refine((value) => value, 'Required'),
  evidence: z.boolean().refine((value) => value, 'Required'),
  ai: z.boolean().refine((value) => value, 'Required'),
});

type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'tenant',
      service: false,
      evidence: false,
      ai: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.register({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        consent: { service: true, evidence_retention: true, ai_processing: true },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      navigate('/app');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not create the account');
    },
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for tenants. Landlords and property managers get the full condition record."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" placeholder="Priya Sundaram" {...register('name')} />
          {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">I am a</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="landlord">Landlord or property manager</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium">Consent</legend>
          {(
            [
              ['service', 'service'],
              ['evidence', 'evidence_retention'],
              ['ai', 'ai_processing'],
            ] as const
          ).map(([field, purpose]) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: controlled }) => (
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={controlled.value}
                    onCheckedChange={(checked) => controlled.onChange(checked === true)}
                    aria-label={CONSENT_PURPOSE_LABELS[purpose]}
                  />
                  <span className="text-muted-foreground">{CONSENT_PURPOSE_LABELS[purpose]}</span>
                </label>
              )}
            />
          ))}
          {errors.service || errors.evidence || errors.ai ? (
            <p className="text-xs text-destructive">All three consents are required to continue.</p>
          ) : null}
        </fieldset>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
