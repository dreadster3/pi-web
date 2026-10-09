{
  description = "Web UI for the pi coding agent";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system);
      pkgsFor = system: import nixpkgs { inherit system; };
      piWebFor = system: (pkgsFor system).callPackage ./package.nix { src = self; };
    in
    {
      packages = forAllSystems (system: rec {
        pi-web = piWebFor system;
        default = pi-web;
      });

      apps = forAllSystems (system: rec {
        pi-web = {
          type = "app";
          program = "${self.packages.${system}.pi-web}/bin/pi-web";
          meta = self.packages.${system}.pi-web.meta;
        };
        default = pi-web;
      });

      overlays.default = final: _: {
        pi-web = final.callPackage ./package.nix { src = self; };
      };

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              playwright-driver.browsers
            ];
            NEXT_TELEMETRY_DISABLED = "1";
            PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
            PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
            PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "ubuntu-24.04";
          };
        }
      );
    };
}
