import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Send } from 'lucide-react';
import { listStates, parseRupeesToPaise, type Property, type SessionUser } from '@makaan/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatPaise } from '@/lib/format';
import { queryKeys, useProperties } from '@/hooks/use-api';

const STATES = listStates();
const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'independent_house', label: 'Independent house' },
  { value: 'room', label: 'Room' },
  { value: 'hostel_pg', label: 'Hostel or PG' },
] as const;

const propertySchema = z.object({
  title: z.string().trim().min(3, 'Give the property a title'),
  addressLine: z.string().trim().min(3, 'Add the address'),
  city: z.string().trim().min(2, 'Add the city'),
  stateCode: z.string().min(2, 'Choose a state'),
  propertyType: z.enum(['apartment', 'independent_house', 'room', 'hostel_pg']),
  bedrooms: z.number().int().min(0).max(20),
  rent: z.string().refine((value) => parseRupeesToPaise(value) !== null, 'Enter a valid amount'),
  deposit: z.string().refine((value) => parseRupeesToPaise(value) !== null, 'Enter a valid amount'),
});
type PropertyForm = z.infer<typeof propertySchema>;

const inviteSchema = z.object({
  tenantEmail: z.string().trim().email('Enter a valid email'),
  startDate: z.string().min(4, 'Choose a start date'),
  endDate: z.string().optional(),
  deposit: z.string().refine((value) => parseRupeesToPaise(value) !== null, 'Enter a valid amount'),
});
type InviteForm = z.infer<typeof inviteSchema>;

function CreatePropertyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      addressLine: '',
      city: 'bengaluru',
      stateCode: 'KA',
      propertyType: 'apartment',
      bedrooms: 2,
      rent: '35000',
      deposit: '100000',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: PropertyForm) =>
      api.createProperty({
        title: values.title,
        addressLine: values.addressLine,
        city: values.city,
        stateCode: values.stateCode,
        propertyType: values.propertyType,
        bedrooms: values.bedrooms,
        monthlyRentPaise: parseRupeesToPaise(values.rent) ?? 0,
        defaultDepositPaise: parseRupeesToPaise(values.deposit) ?? 0,
      }),
    onSuccess: async (result) => {
      toast.success('Property added');
      if (result.warning) toast.warning(result.warning, { duration: 8000 });
      await queryClient.invalidateQueries({ queryKey: queryKeys.properties });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not add the property'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>
            This creates the record that tenancies and condition reports hang off.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Two bedroom in Indiranagar"
              {...form.register('title')}
            />
            {form.formState.errors.title ? (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine">Address</Label>
            <Input
              id="addressLine"
              placeholder="12th Main Road"
              {...form.register('addressLine')}
            />
            {form.formState.errors.addressLine ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.addressLine.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...form.register('city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stateCode">State</Label>
              <Controller
                control={form.control}
                name="stateCode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="stateCode">
                      <SelectValue placeholder="Choose a state" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyType">Type</Label>
              <Controller
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="propertyType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                min={0}
                {...form.register('bedrooms', { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rent">Monthly rent (Rs)</Label>
              <Input id="rent" inputMode="numeric" {...form.register('rent')} />
              {form.formState.errors.rent ? (
                <p className="text-xs text-destructive">{form.formState.errors.rent.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit">Security deposit (Rs)</Label>
              <Input id="deposit" inputMode="numeric" {...form.register('deposit')} />
              {form.formState.errors.deposit ? (
                <p className="text-xs text-destructive">{form.formState.errors.deposit.message}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding' : 'Add property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  property,
  open,
  onOpenChange,
}: {
  property: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { tenantEmail: '', startDate: '', endDate: '', deposit: '100000' },
  });

  const mutation = useMutation({
    mutationFn: (values: InviteForm) =>
      api.createTenancy({
        propertyId: property?.id,
        tenantEmail: values.tenantEmail,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        depositPaise: parseRupeesToPaise(values.deposit) ?? 0,
      }),
    onSuccess: async () => {
      toast.success('Invitation sent');
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenancies });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Could not invite the tenant'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a tenant</DialogTitle>
          <DialogDescription>
            {property ? `For ${property.title}. ` : ''}The tenant accepts with the same email
            address.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="tenantEmail">Tenant email</Label>
            <Input
              id="tenantEmail"
              type="email"
              placeholder="tenant@example.com"
              {...form.register('tenantEmail')}
            />
            {form.formState.errors.tenantEmail ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.tenantEmail.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...form.register('startDate')} />
              {form.formState.errors.startDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date (optional)</Label>
              <Input id="endDate" type="date" {...form.register('endDate')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteDeposit">Security deposit (Rs)</Label>
            <Input id="inviteDeposit" inputMode="numeric" {...form.register('deposit')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending' : 'Send invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Properties({ user }: { user: SessionUser }) {
  const properties = useProperties();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteProperty, setInviteProperty] = useState<Property | null>(null);

  const list = properties.data?.properties ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 className="mt-2 text-3xl text-foreground">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role === 'landlord'
              ? 'Every property holds its own tenancies and condition records.'
              : 'Properties linked to your tenancies.'}
          </p>
        </div>
        {user.role === 'landlord' ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a property
          </Button>
        ) : null}
      </div>

      {properties.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {user.role === 'landlord'
                ? 'No properties yet. Add the first one to start a tenancy.'
                : 'No properties are linked to your account yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((property) => (
            <Card key={property.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{property.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {property.addressLine}, {property.city}
                  </p>
                </div>
                <Badge variant="muted">{property.stateCode}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Rent</dt>
                    <dd className="mono font-medium">{formatPaise(property.monthlyRentPaise)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Deposit</dt>
                    <dd className="mono font-medium">
                      {formatPaise(property.defaultDepositPaise)}
                    </dd>
                  </div>
                </dl>
                {user.role === 'landlord' ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setInviteProperty(property)}
                  >
                    <Send className="h-4 w-4" aria-hidden="true" /> Invite a tenant
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Looking for a tenancy? Open it from the{' '}
        <Link to="/app" className="text-primary hover:underline">
          overview
        </Link>
        .
      </p>

      <CreatePropertyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <InviteDialog
        property={inviteProperty}
        open={inviteProperty !== null}
        onOpenChange={(open) => {
          if (!open) setInviteProperty(null);
        }}
      />
    </div>
  );
}
