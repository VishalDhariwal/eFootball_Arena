import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, useMarkAsRead } from "@/features/notifications/hooks/useNotifications";
import { useAuth } from "@/features/auth/hooks/useAuth";

export const NotificationsPopover = () => {
  const { user } = useAuth();
  const { data: notifications } = useNotifications(user?.id);
  const markAsRead = useMarkAsRead();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground hover:text-white transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4 mt-2 bg-card border-border shadow-elevated" align="end">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-bold">Notifications</h3>
          <span className="text-xs text-muted-foreground">{unreadCount} new</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {!notifications || notifications.length === 0 ? (
            <p className="p-4 text-sm text-center text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 border-b border-border/50 text-sm transition-colors ${n.is_read ? 'opacity-70' : 'bg-primary/5 hover:bg-primary/10'}`}
              >
                <p className="mb-1">{n.message}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(n.created_at))}
                  </span>
                  {!n.is_read && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs px-2"
                      onClick={() => markAsRead.mutate({ notificationId: n.id })}
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
