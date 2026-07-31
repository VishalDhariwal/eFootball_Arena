import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, CheckCircle, X, Clock, Search, UserCheck, UserX, Filter, Trash, Mail, Phone, Gamepad2, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { toast } from "sonner";

type ProfileStatus = 'pending' | 'approved' | 'rejected';

const statusColors: Record<ProfileStatus, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const useAllUsers = () => useQuery({
  queryKey: ['admin-all-users'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});

const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: ProfileStatus }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
    },
  });
};

const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('rpc_admin_delete_user', { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      toast.success("User deleted successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to delete user: " + err.message);
    }
  });
};

const AdminUsersPage = () => {
  const { data: users, isLoading } = useAllUsers();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const [filter, setFilter] = useState<'all' | ProfileStatus>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const filtered = users?.filter(u => {
    const matchFilter = filter === 'all' || u.status === filter;
    const matchSearch = !search ||
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.player_id?.toLowerCase().includes(search.toLowerCase()) ||
      u.game_id?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }) || [];

  const counts = {
    pending: users?.filter(u => u.status === 'pending').length || 0,
    approved: users?.filter(u => u.status === 'approved').length || 0,
    rejected: users?.filter(u => u.status === 'rejected').length || 0,
  };

  const handleStatus = (userId: string, status: ProfileStatus) => {
    updateStatus.mutate({ userId, status }, {
      onSuccess: () => toast.success(`User ${status}`),
      onError: () => toast.error('Failed to update status'),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-4xl font-display font-bold">User Management</h1>
          </div>
          <p className="text-muted-foreground">Approve or reject player access requests</p>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { status: 'pending', label: 'Pending Approval', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
            { status: 'approved', label: 'Approved', icon: UserCheck, color: 'text-green-400', bg: 'bg-green-500/10' },
            { status: 'rejected', label: 'Rejected', icon: UserX, color: 'text-red-400', bg: 'bg-red-500/10' },
          ].map(item => (
            <Card
              key={item.status}
              className={`p-4 cursor-pointer transition-all border ${filter === item.status ? 'border-primary/50 bg-primary/5' : 'bg-card border-border hover:border-border/80'}`}
              onClick={() => setFilter(filter === item.status ? 'all' : item.status as ProfileStatus)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-display font-bold mt-1">{counts[item.status as ProfileStatus]}</p>
                </div>
                <div className={`p-3 rounded-xl ${item.bg}`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, player ID, or game ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => { setFilter('all'); setSearch(''); }}>
            <Filter className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>

        {/* Users Table */}
        <Card className="overflow-hidden bg-card border-border">
          <div className="bg-muted/5 border-b border-border grid grid-cols-12 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
            <div className="col-span-3">Name</div>
            <div className="col-span-4">Email</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No users found</div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="col-span-3">
                    <p className="font-semibold text-white truncate">{user.display_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-4 flex items-center gap-2 text-sm text-muted-foreground truncate min-w-0">
                    <span className="truncate">{user.email || '—'}</span>
                    {user.player_id && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted font-mono shrink-0">{user.player_id}</span>
                    )}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${statusColors[user.status as ProfileStatus] || statusColors.pending}`}>
                      {user.status}
                    </span>
                  </div>
                  <div className="col-span-3 flex justify-end gap-2">
                    {user.status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500 hover:text-white h-8 px-2"
                        onClick={(e) => { e.stopPropagation(); handleStatus(user.id, 'approved'); }}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    )}
                    {user.status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white h-8 px-2"
                        onClick={(e) => { e.stopPropagation(); handleStatus(user.id, 'rejected'); }}
                        disabled={updateStatus.isPending}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white h-8 px-2 ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to completely delete ${user.display_name}? This action cannot be undone.`)) {
                          deleteUser.mutate(user.id);
                        }
                      }}
                      disabled={deleteUser.isPending}
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border bg-muted/5 text-xs text-muted-foreground">
            {filtered.length} of {users?.length || 0} users shown
          </div>
        </Card>
      </motion.div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display text-2xl font-bold">
                  {selectedUser.display_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.display_name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColors[selectedUser.status as ProfileStatus] || statusColors.pending}`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email Address</p>
                    <p className="font-medium">{selectedUser.email || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{selectedUser.phone_number || '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Hash className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Player ID</p>
                      <p className="font-mono text-sm">{selectedUser.player_id || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Game ID</p>
                      <p className="font-mono text-sm">{selectedUser.game_id || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPage;
