import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  FolderUp,
  LayoutDashboard,
  Library,
  LogOut,
  Settings2,
  Trophy,
  TreeDeciduous,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProfile, useSession } from "@/lib/auth";

const items = [
  { title: "Басты бет", url: "/dashboard", icon: LayoutDashboard },
  { title: "Рейтинг", url: "/rating", icon: Trophy },
  { title: "Есептер", url: "/reports", icon: FolderUp },
  { title: "EduQor", url: "/eduqor", icon: Library },
  { title: "Іс-шаралар", url: "/events", icon: CalendarDays },
  { title: "Қатысым", url: "/attendance", icon: ClipboardCheck },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useSession();
  const { data } = useProfile(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-1 py-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <TreeDeciduous className="size-4" />
          </span>
          {!collapsed && (
            <span className="truncate font-display text-base font-bold tracking-tight">
              TÄRBIE OS
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Бөлімдер</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {data?.isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} tooltip="Басқару">
                    <Link to="/admin" className="flex items-center gap-2">
                      <Settings2 className="size-4 shrink-0" />
                      <span>Басқару</span>
                    </Link>
                  </SidebarMenuButton>
                  {!collapsed && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === "/class-criteria"}
                        >
                          <Link to="/class-criteria">Сынып критерийлері</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <p className="truncate px-2 text-xs opacity-70">
            {data?.profile?.full_name || data?.profile?.username}
            {data?.isAdmin ? " · әкімші" : ""}
          </p>
        )}
        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={signOut}>
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Шығу</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
