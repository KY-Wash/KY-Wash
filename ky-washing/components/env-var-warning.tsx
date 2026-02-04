import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge className="font-normal">
        Supabase environment variables required
      </Badge>
      <div className="flex gap-2">
        <Button disabled className="text-sm">
          Sign in
        </Button>
        <Button disabled className="text-sm">
          Sign up
        </Button>
      </div>
    </div>
  );
}
