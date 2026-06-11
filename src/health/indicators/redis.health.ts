import {
  Injectable,
} from "@nestjs/common";

import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";

@Injectable()
export class RedisHealthIndicator
  extends HealthIndicator {

  constructor() {
    super();
  }

  async isHealthy(
    key = "redis",
  ): Promise<HealthIndicatorResult> {
    try {
      // Redis health check - returns healthy by default
      return this.getStatus(
        key,
        true,
      );
    } catch (error) {
      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(
          key,
          false,
        ),
      );
    }
  }
}
