'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

interface Props {
  url: string
  label: string
  triggerClassName?: string
}

export function PhotoModal({ url, label, triggerClassName }: Props) {
  return (
    <Dialog>
      <DialogTrigger className={triggerClassName ?? 'text-xs text-primary underline'}>
        photo
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-2xl p-2">
        <DialogPrimitive.Title className="text-xs text-gray-500 px-2 pt-2 pb-1">
          {label}
        </DialogPrimitive.Title>
        <img
          src={url}
          alt={label}
          className="w-full rounded object-contain max-h-[80vh]"
        />
      </DialogContent>
    </Dialog>
  )
}
